import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import {
    createCandidate,
    createJob,
    createRecruiterWithCompany,
} from '../helpers/factories';
import { Job } from '../../src/models/job.model';
import { Application } from '../../src/models/application.model';
import { CandidateProfile } from '../../src/models/candidateProfile.model';
import { Company } from '../../src/models/company.model';
import { ApplicationStatus, JobStatus } from '../../src/constants/enums';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/** A published job at an approved company, plus a candidate able to apply. */
const scenario = async ({
    jobStatus = JobStatus.PUBLISHED,
    companyStatus = 'approved' as const,
    withResume = true,
} = {}) => {
    const { recruiter, company } = await createRecruiterWithCompany({
        companyStatus,
    });

    const job = await createJob({
        companyId: company._id,
        createdBy: recruiter._id,
        status: jobStatus,
    });

    const candidate = await createCandidate({ withResume });
    const cookies = await login(candidate.email);

    return { recruiter, company, job, candidate, cookies };
};

describe('POST /jobs/:jobId/apply', () => {
    it('creates an application and starts it at APPLIED', async () => {
        const { job, candidate, cookies } = await scenario();

        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({ coverLetter: 'I would like this job.' });

        expect(res.status).toBe(HTTP_STATUS.CREATED);

        const stored = await Application.findOne({ candidateId: candidate._id });
        expect(stored).not.toBeNull();
        expect(stored!.status).toBe(ApplicationStatus.APPLIED);
    });

    it('increments the job counter in the same breath', async () => {
        const { job, cookies } = await scenario();

        await api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({});

        const updated = await Job.findById(job._id);
        expect(updated!.applicationCount).toBe(1);
    });

    it('snapshots the résumé so later profile edits cannot rewrite it', async () => {
        const { job, candidate, cookies } = await scenario();

        await api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({});

        await CandidateProfile.updateOne(
            { user: candidate._id },
            { $set: { 'resume.url': 'https://example.com/a-different-resume.pdf' } },
        );

        const stored = await Application.findOne({ candidateId: candidate._id });

        // What the recruiter reviewed, not what the candidate uploaded since.
        expect(stored!.resumeUrl).toContain('resume.pdf');
        expect(stored!.resumeUrl).not.toContain('a-different-resume');
    });

    it('opens the audit trail with the candidate as the actor', async () => {
        const { job, candidate, cookies } = await scenario();

        await api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({});

        const stored = await Application.findOne({ candidateId: candidate._id });

        expect(stored!.statusHistory).toHaveLength(1);
        expect(stored!.statusHistory[0].status).toBe(ApplicationStatus.APPLIED);
        expect(stored!.statusHistory[0].changedBy.toString()).toBe(
            candidate._id.toString(),
        );
    });

    it('rejects a second application with a 409', async () => {
        const { job, cookies } = await scenario();

        const first = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});
        expect(first.status).toBe(HTTP_STATUS.CREATED);

        const second = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(second.status).toBe(HTTP_STATUS.ALREADY_EXISTS);
        expect(await Application.countDocuments({ jobId: job._id })).toBe(1);
    });

    it('survives two simultaneous applications, storing exactly one', async () => {
        const { job, cookies } = await scenario();

        // A read-then-write guard would let both of these through. The unique
        // (jobId, candidateId) index is what actually holds.
        const [a, b] = await Promise.all([
            api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({}),
            api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({}),
        ]);

        expect([a.status, b.status].sort()).toEqual([
            HTTP_STATUS.CREATED,
            HTTP_STATUS.ALREADY_EXISTS,
        ]);
        expect(await Application.countDocuments({ jobId: job._id })).toBe(1);
    });

    it('leaves the counter at 1 when the duplicate is rejected', async () => {
        const { job, cookies } = await scenario();

        await api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({});
        await api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({});

        // The insert and the increment share a transaction, so a rejected
        // application must not have bumped the count.
        const updated = await Job.findById(job._id);
        expect(updated!.applicationCount).toBe(1);
    });

    it.each([
        ['a draft job', JobStatus.DRAFT],
        ['a closed job', JobStatus.CLOSED],
    ])('hides %s behind a 404', async (_label, jobStatus) => {
        const { job, cookies } = await scenario({ jobStatus });

        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
        expect(await Application.countDocuments()).toBe(0);
    });

    it('stops accepting applications the moment a company is suspended', async () => {
        const { job, company, cookies } = await scenario();

        await Company.updateOne(
            { _id: company._id },
            { $set: { status: 'suspended' } },
        );

        // Not one job record was touched, but the job is now unreachable.
        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    });

    it('requires a résumé on the profile', async () => {
        const { job, cookies } = await scenario({ withResume: false });

        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(res.body.message).toMatch(/résumé|resume/i);
    });

    it('turns a malformed job id into a 400, not a 500', async () => {
        const { cookies } = await scenario();

        const res = await api()
            .post('/jobs/not-an-object-id/apply')
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('refuses a recruiter trying to apply', async () => {
        const { recruiter, company } = await createRecruiterWithCompany();
        const job = await createJob({
            companyId: company._id,
            createdBy: recruiter._id,
        });
        const cookies = await login(recruiter.email);

        const res = await api()
            .post(`/jobs/${job._id}/apply`)
            .set('Cookie', cookies)
            .send({});

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('refuses an anonymous application', async () => {
        const { job } = await scenario();

        const res = await api().post(`/jobs/${job._id}/apply`).send({});

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
});

describe('PATCH /applications/:applicationId/status', () => {
    /** An application sitting at APPLIED, plus the recruiter who owns it. */
    const pipeline = async () => {
        const { recruiter, company, job, cookies } = await scenario();

        await api().post(`/jobs/${job._id}/apply`).set('Cookie', cookies).send({});

        const application = await Application.findOne({ jobId: job._id });
        const recruiterCookies = await login(recruiter.email);

        return { application: application!, recruiterCookies, company, job };
    };

    it('moves an application forward one legal step', async () => {
        const { application, recruiterCookies } = await pipeline();

        const res = await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: ApplicationStatus.SHORTLISTED });

        expect(res.status).toBe(HTTP_STATUS.OK);

        const updated = await Application.findById(application._id);
        expect(updated!.status).toBe(ApplicationStatus.SHORTLISTED);
    });

    it('appends to the audit trail with the recruiter and their note', async () => {
        const { application, recruiterCookies } = await pipeline();

        await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({
                status: ApplicationStatus.SHORTLISTED,
                note: 'Strong backend background',
            });

        const updated = await Application.findById(application._id);

        expect(updated!.statusHistory).toHaveLength(2);
        expect(updated!.statusHistory[1].note).toBe('Strong backend background');
    });

    it('refuses to skip a stage', async () => {
        const { application, recruiterCookies } = await pipeline();

        const res = await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: ApplicationStatus.HIRED });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);

        const unchanged = await Application.findById(application._id);
        expect(unchanged!.status).toBe(ApplicationStatus.APPLIED);
    });

    it('cannot revive a rejected candidate', async () => {
        const { application, recruiterCookies } = await pipeline();

        await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: ApplicationStatus.REJECTED });

        const res = await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: ApplicationStatus.SHORTLISTED });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(res.body.message).toMatch(/final state/i);
    });

    it('rejects a move to the status it is already in', async () => {
        const { application, recruiterCookies } = await pipeline();

        const res = await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: ApplicationStatus.APPLIED });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('rejects a status that is not in the enum', async () => {
        const { application, recruiterCookies } = await pipeline();

        const res = await api()
            .patch(`/applications/${application._id}/status`)
            .set('Cookie', recruiterCookies)
            .send({ status: 'PROMOTED' });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('walks the full pipeline through to HIRED', async () => {
        const { application, recruiterCookies } = await pipeline();

        for (const status of [
            ApplicationStatus.SHORTLISTED,
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.HIRED,
        ]) {
            const res = await api()
                .patch(`/applications/${application._id}/status`)
                .set('Cookie', recruiterCookies)
                .send({ status });

            expect(res.status, `moving to ${status}`).toBe(HTTP_STATUS.OK);
        }

        const final = await Application.findById(application._id);
        expect(final!.status).toBe(ApplicationStatus.HIRED);
        expect(final!.statusHistory).toHaveLength(4);
    });
});
