import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import {
    TEST_PASSWORD,
    createCandidate,
    createJob,
    createRecruiterWithCompany,
} from '../helpers/factories';
import { Application } from '../../src/models/application.model';
import { Company } from '../../src/models/company.model';
import { CompanyMember } from '../../src/models/companyMember.model';
import { RecruiterProfile } from '../../src/models/recruiterProfile.model';
import { User } from '../../src/models/user.model';
import { ApplicationStatus, CompanyRole } from '../../src/constants/enums';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/**
 * Removing a teammate must remove the *membership*, not the person.
 *
 * The account, the profile and — most of all — every `statusHistory.changedBy`
 * that person wrote have to survive, or an ordinary HR action silently rewrites
 * the audit trail on applications they touched.
 */

/** An owner, their approved company, and one recruiter hired through the API. */
const companyWithRecruiter = async () => {
    const owner = await createRecruiterWithCompany();
    const ownerCookies = await login(owner.recruiter.email);

    const res = await api()
        .post('/company/create-recruiter')
        .set('Cookie', ownerCookies)
        .send({
            name: 'Removable Recruiter',
            email: 'removable-recruiter@example.com',
            password: TEST_PASSWORD,
        });

    expect(res.status).toBe(HTTP_STATUS.CREATED);

    return {
        ...owner,
        ownerCookies,
        recruiterId: res.body.data.user._id as string,
        recruiterEmail: res.body.data.user.email as string,
    };
};

describe('removing a company recruiter', () => {
    it('drops the membership and leaves the account alone', async () => {
        const { company, ownerCookies, recruiterId } =
            await companyWithRecruiter();

        const res = await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', ownerCookies);

        expect(res.status).toBe(HTTP_STATUS.OK);

        expect(
            await CompanyMember.findOne({
                userId: recruiterId,
                companyId: company._id,
            }),
        ).toBeNull();

        // The person is not the membership. Deleting the User here is what
        // broke the audit trail asserted further down.
        expect(await User.findById(recruiterId)).not.toBeNull();
    });

    it('leaves the removed recruiter able to log in', async () => {
        const { ownerCookies, recruiterId, recruiterEmail } =
            await companyWithRecruiter();

        await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', ownerCookies);

        // login() throws on a non-200 — the account still authenticates, it
        // just no longer belongs anywhere.
        await login(recruiterEmail);
    });

    it('cuts off company access immediately', async () => {
        const { ownerCookies, recruiterId, recruiterEmail } =
            await companyWithRecruiter();

        const recruiterCookies = await login(recruiterEmail);

        await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', ownerCookies);

        // Scope is read from the membership row on every request, so the token
        // they still hold stops resolving to a company the moment it is gone.
        const res = await api()
            .get('/company/members')
            .set('Cookie', recruiterCookies);

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('keeps the profile and detaches it from the company', async () => {
        const { ownerCookies, recruiterId } = await companyWithRecruiter();

        await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', ownerCookies);

        const profile = await RecruiterProfile.findOne({ user: recruiterId });

        expect(profile).not.toBeNull();
        expect(profile!.currentCompanyId).toBeNull();
    });

    it('pulls them from the roster and decrements the count', async () => {
        const { company, ownerCookies, recruiterId } =
            await companyWithRecruiter();

        const before = await Company.findById(company._id);
        expect(before!.recruiterCount).toBe(2);

        await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', ownerCookies);

        const after = await Company.findById(company._id);

        expect(after!.recruiterCount).toBe(1);
        expect(after!.members.map((id) => id.toString())).not.toContain(
            recruiterId,
        );
    });

    it('never lets the recruiter count drift below its floor', async () => {
        // A membership no `create-recruiter` call ever counted — the same shape
        // as any drift a counter picks up over a company's life.
        // `recruiterCount` is `min: 1`, but update operators skip validators,
        // so an unguarded `$inc: -1` would take this to 0.
        const { company, recruiter } = await createRecruiterWithCompany();
        const ownerCookies = await login(recruiter.email);

        const stray = await User.create({
            name: 'Uncounted Recruiter',
            email: 'uncounted@example.com',
            password: 'irrelevant',
            role: 'recruiter',
        });

        await CompanyMember.create({
            userId: stray._id,
            companyId: company._id,
            role: CompanyRole.RECRUITER,
            status: true,
        });

        const res = await api()
            .delete(`/company/recruiters/${stray._id}`)
            .set('Cookie', ownerCookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect((await Company.findById(company._id))!.recruiterCount).toBe(1);
    });

    it('cannot reach the owner', async () => {
        const { recruiter, ownerCookies } = await companyWithRecruiter();

        // Role is part of the lookup, so the one member a company may not be
        // left without is invisible to this endpoint.
        const res = await api()
            .delete(`/company/recruiters/${recruiter._id}`)
            .set('Cookie', ownerCookies);

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it("cannot reach another company's recruiter", async () => {
        const { recruiterId } = await companyWithRecruiter();
        const outsider = await createRecruiterWithCompany({
            companyName: 'Globex',
        });
        const outsiderCookies = await login(outsider.recruiter.email);

        const res = await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', outsiderCookies);

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
        expect(
            await CompanyMember.findOne({ userId: recruiterId }),
        ).not.toBeNull();
    });
});

describe('the audit trail after a removal', () => {
    it('still names who moved the application', async () => {
        const { company, ownerCookies, recruiterId, recruiterEmail } =
            await companyWithRecruiter();

        const job = await createJob({
            companyId: company._id,
            createdBy: company.createdBy,
        });

        const candidate = await createCandidate();
        await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', await login(candidate.email))
            .send({});

        const application = (await Application.findOne({ jobId: job._id }))!;

        const recruiterCookies = await login(recruiterEmail);
        const moved = await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: ApplicationStatus.SHORTLISTED });

        expect(moved.status).toBe(HTTP_STATUS.OK);

        await api()
            .delete(`/company/recruiters/${recruiterId}`)
            .set('Cookie', ownerCookies);

        const audited = await Application.findById(application._id).populate<{
            statusHistory: { changedBy: { name: string } | null }[];
        }>('statusHistory.changedBy', 'name');

        const history = audited!.statusHistory;
        const entry = history[history.length - 1];

        // The whole point: the record of who shortlisted or rejected someone
        // outlives their employment.
        expect(entry.changedBy).not.toBeNull();
        expect(entry.changedBy!.name).toBe('Removable Recruiter');
    });
});
