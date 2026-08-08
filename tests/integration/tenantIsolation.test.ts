import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import {
    createCandidate,
    createJob,
    createRecruiterWithCompany,
} from '../helpers/factories';
import { Application } from '../../src/models/application.model';
import { CompanyMember } from '../../src/models/companyMember.model';
import { Job } from '../../src/models/job.model';
import { ApplicationStatus, CompanyRole } from '../../src/constants/enums';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/**
 * Two unrelated companies, each with a job and an application.
 *
 * The property under test throughout: company scope comes from the caller's
 * membership row, never from the request, and anything belonging to another
 * tenant answers 404 — not 403, which would confirm the record exists.
 */
const twoCompanies = async () => {
    const acme = await createRecruiterWithCompany({ companyName: 'Acme' });
    const globex = await createRecruiterWithCompany({ companyName: 'Globex' });

    const acmeJob = await createJob({
        companyId: acme.company._id,
        createdBy: acme.recruiter._id,
        title: 'Acme Backend Engineer',
    });

    const globexJob = await createJob({
        companyId: globex.company._id,
        createdBy: globex.recruiter._id,
        title: 'Globex Backend Engineer',
    });

    const candidate = await createCandidate();
    const candidateCookies = await login(candidate.email);

    await api()
        .post(`/jobs/${globexJob._id}/apply`)
        .set('Cookie', candidateCookies)
        .send({});

    const globexApplication = (await Application.findOne({
        jobId: globexJob._id,
    }))!;

    return {
        acme,
        globex,
        acmeJob,
        globexJob,
        globexApplication,
        candidate,
        candidateCookies,
        acmeCookies: await login(acme.recruiter.email),
        globexCookies: await login(globex.recruiter.email),
    };
};

describe('cross-tenant reads', () => {
    it("hides another company's job behind a 404", async () => {
        const { globexJob, acmeCookies } = await twoCompanies();

        const res = await api()
            .get(`/jobs/manage/${globexJob._id}`)
            .set('Cookie', acmeCookies);

        // 403 would confirm the ID is real. 404 says nothing.
        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it("hides another company's pipeline behind a 404", async () => {
        const { globexJob, acmeCookies } = await twoCompanies();

        const res = await api()
            .get(`/jobs/${globexJob._id}/applications`)
            .set('Cookie', acmeCookies);

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it("hides another company's application behind a 404", async () => {
        const { globexApplication, acmeCookies } = await twoCompanies();

        const res = await api()
            .get(`/applications/${globexApplication._id}`)
            .set('Cookie', acmeCookies);

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('lists only its own jobs on the company board', async () => {
        const { acmeCookies } = await twoCompanies();

        const res = await api().get('/jobs/manage').set('Cookie', acmeCookies);

        expect(res.status).toBe(HTTP_STATUS.OK);

        const titles = JSON.stringify(res.body);
        expect(titles).toContain('Acme Backend Engineer');
        expect(titles).not.toContain('Globex Backend Engineer');
    });

    it('lets the owning company read its own application', async () => {
        const { globexApplication, globexCookies } = await twoCompanies();

        const res = await api()
            .get(`/applications/${globexApplication._id}`)
            .set('Cookie', globexCookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
    });
});

describe('cross-tenant writes', () => {
    it("refuses to move another company's application", async () => {
        const { globexApplication, acmeCookies } = await twoCompanies();

        const res = await api()
            .patch(`/applications/${globexApplication._id}/status`)
            .set('Cookie', acmeCookies)
            .send({ status: ApplicationStatus.REJECTED });

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);

        const unchanged = await Application.findById(globexApplication._id);
        expect(unchanged!.status).toBe(ApplicationStatus.APPLIED);
    });

    it("refuses to edit another company's job", async () => {
        const { globexJob, acmeCookies } = await twoCompanies();

        const res = await api()
            .patch(`/jobs/${globexJob._id}`)
            .set('Cookie', acmeCookies)
            .send({ title: 'Renamed by a stranger' });

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);

        const unchanged = await Job.findById(globexJob._id);
        expect(unchanged!.title).toBe('Globex Backend Engineer');
    });

    it("refuses to delete another company's job", async () => {
        const { globexJob, acmeCookies } = await twoCompanies();

        const res = await api()
            .delete(`/jobs/${globexJob._id}`)
            .set('Cookie', acmeCookies);

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);

        const unchanged = await Job.findById(globexJob._id);
        expect(unchanged!.isArchived).toBe(false);
    });

    it('files a new job under the caller’s own company, whatever the body claims', async () => {
        const { acme, globex, acmeCookies } = await twoCompanies();

        await api()
            .post('/jobs')
            .set('Cookie', acmeCookies)
            .send({
                title: 'Planted Job',
                description: 'An attempt to create a job inside another tenant.',
                employmentType: 'FULL_TIME',
                skills: ['node'],
                // Ignored — scope is read from the membership row, not here.
                companyId: globex.company._id.toString(),
            });

        expect(await Job.countDocuments({ title: 'Planted Job', companyId: globex.company._id })).toBe(0);

        // Either the strict DTO rejected the unknown key or the job landed in
        // Acme. Both are correct; a job inside Globex would not be.
        const planted = await Job.findOne({ title: 'Planted Job' });
        if (planted) {
            expect(planted.companyId.toString()).toBe(acme.company._id.toString());
        }
    });
});

describe('membership state', () => {
    it('turns a blocked member away with a 403', async () => {
        const { acme, acmeCookies } = await twoCompanies();

        await CompanyMember.updateOne(
            { userId: acme.recruiter._id },
            { $set: { status: false } },
        );

        const res = await api().get('/jobs/manage').set('Cookie', acmeCookies);

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
        expect(res.body.message).toMatch(/blocked/i);
    });

    it('turns a recruiter with no company away with a 403', async () => {
        const { acme, acmeCookies } = await twoCompanies();

        await CompanyMember.deleteOne({ userId: acme.recruiter._id });

        const res = await api().get('/jobs/manage').set('Cookie', acmeCookies);

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('lets a plain RECRUITER read but not delete', async () => {
        const { company, recruiter } = await createRecruiterWithCompany({
            role: CompanyRole.RECRUITER,
        });
        const job = await createJob({
            companyId: company._id,
            createdBy: recruiter._id,
        });
        const cookies = await login(recruiter.email);

        expect(
            (await api().get('/jobs/manage').set('Cookie', cookies)).status,
        ).toBe(HTTP_STATUS.OK);

        // Deleting is OWNER/ADMIN only.
        const res = await api().delete(`/jobs/${job._id}`).set('Cookie', cookies);
        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });
});

describe('candidate scope', () => {
    it("hides another candidate's application", async () => {
        const { globexApplication } = await twoCompanies();

        const stranger = await createCandidate();
        const strangerCookies = await login(stranger.email);

        const res = await api()
            .get(`/applications/${globexApplication._id}`)
            .set('Cookie', strangerCookies);

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('lets a candidate read their own application', async () => {
        const { globexApplication, candidateCookies } = await twoCompanies();

        const res = await api()
            .get(`/applications/${globexApplication._id}`)
            .set('Cookie', candidateCookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
    });

    it('lists only the requesting candidate’s own applications', async () => {
        const { candidateCookies } = await twoCompanies();

        const stranger = await createCandidate();
        const strangerCookies = await login(stranger.email);

        const mine = await api()
            .get('/applications/me')
            .set('Cookie', candidateCookies);
        const theirs = await api()
            .get('/applications/me')
            .set('Cookie', strangerCookies);

        expect(mine.body.data.applications).toHaveLength(1);
        expect(theirs.body.data.applications).toHaveLength(0);
    });
});
