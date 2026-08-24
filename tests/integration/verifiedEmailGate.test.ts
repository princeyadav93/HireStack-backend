import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import {
    createCandidate,
    createJob,
    createRecruiterWithCompany,
    createUser,
} from '../helpers/factories';
import { Application } from '../../src/models/application.model';
import { Company } from '../../src/models/company.model';
import {
    EmploymentType,
    VerificationTokenType,
} from '../../src/constants/enums';
import { issueToken } from '../../src/services/verificationToken.service';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/**
 * `requireVerifiedEmail` on the three places identity actually matters:
 * creating a company, applying to a job, and creating accounts for teammates.
 *
 * The other half of the design is what is deliberately *not* gated — browsing,
 * profile building and drafting stay open — so those are asserted here too.
 * Widening the gate to "everything behind a login" would pass the first half of
 * this file and fail the second, which is the point.
 */

const NEW_COMPANY = { name: 'Acme Inc', industry: 'Software' };

const teammate = (email: string) => ({
    name: 'New Teammate',
    email,
    password: 'Password123!',
});

describe('POST /company/create', () => {
    it('refuses a recruiter who has not verified their address', async () => {
        // A recruiter with no company yet — the service allows only one.
        const recruiter = await createUser({
            role: 'recruiter',
            isEmailVerified: false,
        });
        const cookies = await login(recruiter.email);

        const res = await api()
            .post('/company/create')
            .set('Cookie', cookies)
            .send(NEW_COMPANY);

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
        expect(res.body.message).toMatch(/verify your email/i);

        // Nothing was written on the way to the 403.
        expect(await Company.countDocuments({ name: NEW_COMPANY.name })).toBe(0);
    });

    it('lets a verified recruiter through', async () => {
        const recruiter = await createUser({ role: 'recruiter' });
        const cookies = await login(recruiter.email);

        const res = await api()
            .post('/company/create')
            .set('Cookie', cookies)
            .send(NEW_COMPANY);

        expect(res.status).toBe(HTTP_STATUS.CREATED);
    });

    it('still answers the role question first', async () => {
        // An unverified candidate could never create a company however many
        // links they click, so being told to check their inbox would be a
        // dead end. Both answers are 403; only one of them is actionable.
        const candidate = await createCandidate({ isEmailVerified: false });
        const cookies = await login(candidate.email);

        const res = await api()
            .post('/company/create')
            .set('Cookie', cookies)
            .send(NEW_COMPANY);

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
        expect(res.body.message).toMatch(/only allowed for recruiters/i);
    });
});

describe('POST /jobs/:jobId/apply', () => {
    /** A published job at an approved company, and a candidate able to apply. */
    const scenario = async ({ isEmailVerified = false } = {}) => {
        const { recruiter, company } = await createRecruiterWithCompany();

        const job = await createJob({
            companyId: company._id,
            createdBy: recruiter._id,
        });

        // With a résumé, so a 403 here can only be the verification gate.
        const candidate = await createCandidate({ isEmailVerified });
        const cookies = await login(candidate.email);

        return { job, candidate, cookies };
    };

    it('refuses a candidate who has not verified their address', async () => {
        const { job, candidate, cookies } = await scenario();

        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
        expect(res.body.message).toMatch(/verify your email/i);
        expect(
            await Application.countDocuments({ candidateId: candidate._id }),
        ).toBe(0);
    });

    it('lets a verified candidate through', async () => {
        const { job, cookies } = await scenario({ isEmailVerified: true });

        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.CREATED);
    });

    it('lifts on the next request, without logging back in', async () => {
        const { job, candidate, cookies } = await scenario();

        const blocked = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});
        expect(blocked.status).toBe(HTTP_STATUS.FORBIDDEN);

        const token = await issueToken(
            candidate._id,
            VerificationTokenType.EMAIL_VERIFICATION,
        );
        await api().post('/auth/verify-email').send({ token });

        // The same cookie, unchanged. verifyJWT reloads the user on every
        // request, so verifying does not strand a live session behind the gate.
        const allowed = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(allowed.status).toBe(HTTP_STATUS.CREATED);
    });
});

describe('creating teammate accounts', () => {
    it('refuses an owner who has not verified their address', async () => {
        const { recruiter } = await createRecruiterWithCompany({
            isEmailVerified: false,
        });
        const cookies = await login(recruiter.email);

        for (const path of ['/company/create-admin', '/company/create-recruiter']) {
            const res = await api()
                .post(path)
                .set('Cookie', cookies)
                .send(teammate('teammate@example.com'));

            expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
            expect(res.body.message).toMatch(/verify your email/i);
        }
    });

    it('lets a verified owner through', async () => {
        const { recruiter } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email);

        const res = await api()
            .post('/company/create-recruiter')
            .set('Cookie', cookies)
            .send(teammate('hired@example.com'));

        expect(res.status).toBe(HTTP_STATUS.CREATED);
    });
});

describe('what the gate deliberately leaves open', () => {
    it('lets an unverified candidate browse and build a profile', async () => {
        const candidate = await createCandidate({ isEmailVerified: false });
        const cookies = await login(candidate.email);

        const board = await api().get('/jobs');
        expect(board.status).toBe(HTTP_STATUS.OK);

        const profile = await api()
            .patch('/candidate/profile/basic')
            .set('Cookie', cookies)
            .send({ skills: ['typescript'] });
        expect(profile.status).toBe(HTTP_STATUS.OK);

        const mine = await api()
            .get('/applications/me')
            .set('Cookie', cookies);
        expect(mine.status).toBe(HTTP_STATUS.OK);
    });

    it('lets an unverified company member draft and manage jobs', async () => {
        const { recruiter } = await createRecruiterWithCompany({
            isEmailVerified: false,
        });
        const cookies = await login(recruiter.email);

        const created = await api()
            .post('/jobs')
            .set('Cookie', cookies)
            .send({
                title: 'Backend Engineer',
                description: 'We are hiring a backend engineer for the API.',
                employmentType: EmploymentType.FULL_TIME,
                skills: ['typescript'],
            });
        expect(created.status).toBe(HTTP_STATUS.CREATED);

        const board = await api().get('/jobs/manage').set('Cookie', cookies);
        expect(board.status).toBe(HTTP_STATUS.OK);
    });
});
