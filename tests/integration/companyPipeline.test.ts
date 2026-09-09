import { describe, expect, it } from 'vitest';
import { api, login } from '../helpers/api';
import { useTestDatabase } from '../helpers/db';
import {
    createApplication,
    createCandidate,
    createJob,
    createRecruiterWithCompany,
    createUser,
} from '../helpers/factories';
import { Job } from '../../src/models/job.model';
import { ApplicationStatus, JobStatus } from '../../src/constants/enums';

/**
 * The company-wide views the frontend opens on.
 *
 * Both are scoped by `req.companyId`, read off the caller's membership record —
 * neither takes an id from the request, so the tenant-isolation cases below are
 * asserting that the scope is genuinely doing the work, not that someone
 * remembered to add a filter.
 */

useTestDatabase();

/**
 * A company with two open roles and three applications spread across them, at
 * three different stages — the shape both endpoints exist to summarise.
 */
const seedCompany = async (companyName: string) => {
    const { recruiter, company } = await createRecruiterWithCompany({
        companyName,
    });

    const backend = await createJob({
        companyId: company._id,
        createdBy: recruiter._id,
        title: 'Backend Engineer',
    });

    const frontend = await createJob({
        companyId: company._id,
        createdBy: recruiter._id,
        title: 'Frontend Engineer',
    });

    const [first, second, third] = await Promise.all([
        createCandidate(),
        createCandidate(),
        createCandidate(),
    ]);

    // Distinct dates, deliberately not in insertion order, so "newest first"
    // cannot pass by accident on the order the rows were written.
    await createApplication({
        jobId: backend._id,
        candidateId: first._id,
        companyId: company._id,
        status: ApplicationStatus.APPLIED,
        createdAt: new Date('2026-03-01T10:00:00Z'),
    });
    await createApplication({
        jobId: frontend._id,
        candidateId: second._id,
        companyId: company._id,
        status: ApplicationStatus.SHORTLISTED,
        createdAt: new Date('2026-03-03T10:00:00Z'),
    });
    await createApplication({
        jobId: backend._id,
        candidateId: third._id,
        companyId: company._id,
        status: ApplicationStatus.APPLIED,
        createdAt: new Date('2026-03-02T10:00:00Z'),
    });

    return { recruiter, company, backend, frontend };
};

describe('GET /company/applications', () => {
    it('spans every job in the company, newest first', async () => {
        const { recruiter } = await seedCompany('Acme');
        const cookies = await login(recruiter.email);

        const res = await api()
            .get('/company/applications')
            .set('Cookie', cookies);

        expect(res.status).toBe(200);
        expect(res.body.data.pagination.total).toBe(3);

        const titles = res.body.data.applications.map(
            (application: { jobId: { title: string } }) =>
                application.jobId.title,
        );

        // Two roles in one list — the whole reason this endpoint exists.
        expect(titles).toEqual([
            'Frontend Engineer',
            'Backend Engineer',
            'Backend Engineer',
        ]);
    });

    it('names the candidate and the role on every row', async () => {
        const { recruiter } = await seedCompany('Acme');
        const cookies = await login(recruiter.email);

        const res = await api()
            .get('/company/applications')
            .set('Cookie', cookies);

        const [row] = res.body.data.applications;

        expect(row.candidateId.email).toBeDefined();
        expect(row.jobId.title).toBeDefined();

        // The trail belongs on the detail endpoint: it grows with every move
        // and no list renders it.
        expect(row.statusHistory).toBeUndefined();
    });

    it('narrows to one stage of the pipeline', async () => {
        const { recruiter } = await seedCompany('Acme');
        const cookies = await login(recruiter.email);

        const res = await api()
            .get('/company/applications?status=SHORTLISTED')
            .set('Cookie', cookies);

        expect(res.body.data.pagination.total).toBe(1);
        expect(res.body.data.applications[0].status).toBe('SHORTLISTED');
    });

    it('rejects a status that is not a pipeline stage', async () => {
        const { recruiter } = await seedCompany('Acme');
        const cookies = await login(recruiter.email);

        const res = await api()
            .get('/company/applications?status=PENDING')
            .set('Cookie', cookies);

        expect(res.status).toBe(400);
    });

    it('paginates', async () => {
        const { recruiter } = await seedCompany('Acme');
        const cookies = await login(recruiter.email);

        const res = await api()
            .get('/company/applications?limit=2')
            .set('Cookie', cookies);

        expect(res.body.data.applications).toHaveLength(2);
        expect(res.body.data.pagination).toMatchObject({
            page: 1,
            limit: 2,
            total: 3,
            pages: 2,
        });
    });

    it('never returns the applications of another company', async () => {
        const { recruiter } = await seedCompany('Acme');
        await seedCompany('Rival');

        const cookies = await login(recruiter.email);
        const res = await api()
            .get('/company/applications')
            .set('Cookie', cookies);

        // Six applications exist. Scope comes from the membership record, so
        // this caller may only ever see their own three.
        expect(res.body.data.pagination.total).toBe(3);
    });

    it('is closed to someone who belongs to no company', async () => {
        const stranger = await createUser({ role: 'recruiter' });
        const cookies = await login(stranger.email);

        const res = await api()
            .get('/company/applications')
            .set('Cookie', cookies);

        expect(res.status).toBe(403);
    });
});

describe('GET /company/dashboard', () => {
    it('counts jobs by status and applications by stage', async () => {
        const { recruiter, company } = await seedCompany('Acme');

        await createJob({
            companyId: company._id,
            createdBy: recruiter._id,
            title: 'Draft Role',
            status: JobStatus.DRAFT,
        });

        const cookies = await login(recruiter.email);
        const res = await api()
            .get('/company/dashboard')
            .set('Cookie', cookies);

        expect(res.status).toBe(200);
        expect(res.body.data.jobs).toEqual({
            DRAFT: 1,
            PUBLISHED: 2,
            CLOSED: 0,
            total: 3,
        });
        expect(res.body.data.applications).toEqual({
            APPLIED: 2,
            SHORTLISTED: 1,
            INTERVIEW: 0,
            REJECTED: 0,
            HIRED: 0,
            total: 3,
        });
    });

    it('reports zero rather than omitting a stage nothing has reached', async () => {
        const { recruiter } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email);

        const res = await api()
            .get('/company/dashboard')
            .set('Cookie', cookies);

        // A $group emits only the buckets that matched, so a new company would
        // otherwise answer with an empty object and leave the client unable to
        // tell "none yet" from "field missing".
        expect(res.body.data.applications).toEqual({
            APPLIED: 0,
            SHORTLISTED: 0,
            INTERVIEW: 0,
            REJECTED: 0,
            HIRED: 0,
            total: 0,
        });
        expect(res.body.data.jobs.total).toBe(0);
    });

    it('leaves archived jobs out of the count', async () => {
        const { recruiter, backend } = await seedCompany('Acme');

        await Job.updateOne({ _id: backend._id }, { isArchived: true });

        const cookies = await login(recruiter.email);
        const res = await api()
            .get('/company/dashboard')
            .set('Cookie', cookies);

        // Soft-deleted so its applications stay readable, but it is off the
        // company's board and is not work in progress any more.
        expect(res.body.data.jobs.PUBLISHED).toBe(1);
        expect(res.body.data.jobs.total).toBe(1);
    });

    it('counts only the company the caller belongs to', async () => {
        const { recruiter } = await seedCompany('Acme');
        await seedCompany('Rival');

        const cookies = await login(recruiter.email);
        const res = await api()
            .get('/company/dashboard')
            .set('Cookie', cookies);

        expect(res.body.data.jobs.total).toBe(2);
        expect(res.body.data.applications.total).toBe(3);
    });
});
