import { describe, expect, it } from 'vitest';
import { api, login } from '../helpers/api';
import { useTestDatabase } from '../helpers/db';
import { createRecruiterWithCompany, createUser } from '../helpers/factories';
import { Company } from '../../src/models/company.model';
import { RecruiterProfile } from '../../src/models/recruiterProfile.model';

/**
 * What the platform's review decisions remember.
 *
 * `archivedBy` sat on the company schema and was never written. Approval — the
 * call that flips the owner's `isPlatformVerified` — recorded nobody. And the
 * rejection reason was read off the body by the controller, passed to a service
 * that ignored it, and answered with "Company rejected successfully", so from
 * outside the text looked accepted. A field that is always null is worse than a
 * missing one: it reads as a promise that the data is there.
 *
 * Every assertion below reads the record back after a real request. A test that
 * stops at the 200 passes just as happily when the write never happens, which
 * is exactly how these three sat unnoticed.
 */

useTestDatabase();

const adminCookies = async () => {
    const admin = await createUser({ role: 'admin' });
    return { admin, cookies: await login(admin.email) };
};

/**
 * A company waiting on review. Approving one flips `isPlatformVerified` on the
 * owner's recruiter profile and 404s when there is no profile to flip, so this
 * fixture builds one — the shared factory stops at the membership.
 */
const pendingCompany = async () => {
    const { recruiter, company } = await createRecruiterWithCompany({
        companyStatus: 'pending',
    });

    await RecruiterProfile.create({
        user: recruiter._id,
        currentCompanyId: company._id,
    });

    return { recruiter, company };
};

describe('POST /admin/companies/approve/:companyId', () => {
    it('records the admin who approved and when', async () => {
        const { admin, cookies } = await adminCookies();
        const { company } = await pendingCompany();

        const res = await api()
            .post(`/admin/companies/approve/${company._id}`)
            .set('Cookie', cookies);

        expect(res.status).toBe(200);

        const stored = await Company.findById(company._id).lean();

        expect(stored?.status).toBe('approved');
        expect(stored?.approvedBy?.toString()).toBe(admin._id.toString());
        expect(stored?.approvedAt).toBeInstanceOf(Date);
    });
});

describe('POST /admin/companies/:companyId/reject', () => {
    it('stores the reason it was given, with the admin and the time', async () => {
        const { admin, cookies } = await adminCookies();
        const { company } = await pendingCompany();

        const res = await api()
            .post(`/admin/companies/${company._id}/reject`)
            .set('Cookie', cookies)
            .send({ reason: 'Registration number does not match the registry' });

        expect(res.status).toBe(200);

        const stored = await Company.findById(company._id).lean();

        expect(stored?.status).toBe('rejected');
        expect(stored?.rejectionReason).toBe(
            'Registration number does not match the registry',
        );
        expect(stored?.rejectedBy?.toString()).toBe(admin._id.toString());
        expect(stored?.rejectedAt).toBeInstanceOf(Date);
    });

    it('still records who rejected when no reason is given', async () => {
        const { admin, cookies } = await adminCookies();
        const { company } = await pendingCompany();

        const res = await api()
            .post(`/admin/companies/${company._id}/reject`)
            .set('Cookie', cookies);

        expect(res.status).toBe(200);

        const stored = await Company.findById(company._id).lean();

        expect(stored?.rejectionReason).toBeUndefined();
        expect(stored?.rejectedBy?.toString()).toBe(admin._id.toString());
    });

    it('refuses an empty reason rather than storing one', async () => {
        const { cookies } = await adminCookies();
        const { company } = await pendingCompany();

        // Whitespace is not an explanation, and a stored empty string is
        // indistinguishable from never having been asked.
        const res = await api()
            .post(`/admin/companies/${company._id}/reject`)
            .set('Cookie', cookies)
            .send({ reason: '   ' });

        expect(res.status).toBe(400);

        const stored = await Company.findById(company._id).lean();

        expect(stored?.status).toBe('pending');
    });
});

describe('DELETE /admin/platform/companies/:companyId', () => {
    it('records the admin who archived the company', async () => {
        const { admin, cookies } = await adminCookies();
        const { company } = await pendingCompany();

        const res = await api()
            .delete(`/admin/platform/companies/${company._id}`)
            .set('Cookie', cookies);

        expect(res.status).toBe(200);

        const stored = await Company.findById(company._id).lean();

        expect(stored?.isArchived).toBe(true);
        expect(stored?.archivedAt).toBeInstanceOf(Date);
        expect(stored?.archivedBy?.toString()).toBe(admin._id.toString());
    });
});

/**
 * The formatter used to spread a hydrated Mongoose document, so every admin
 * action that loads its company inside a transaction — approve, suspend,
 * unsuspend — committed the write and then answered 500 on the way out, because
 * the copied `$__` cache reaches the MongoClient and cannot be serialised. No
 * test called any of the three, which is the only reason it survived; the
 * approve assertion above is what turned it up.
 */
describe('the transactional admin actions answer with a body', () => {
    it('suspends and returns the company, actor included', async () => {
        const { admin, cookies } = await adminCookies();
        const { company } = await pendingCompany();

        const res = await api()
            .post(`/admin/companies/${company._id}/suspend`)
            .set('Cookie', cookies)
            .send({
                reason: 'policy_violation',
                internalDescription: 'Duplicate listings across three accounts',
                publicDescription: 'Your account is under review',
            });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('suspended');

        // An admin is the one role that gets to see who acted.
        expect(res.body.data.suspensionDetails.suspendedBy).toBe(
            admin._id.toString(),
        );
    });

    it('lifts a suspension and returns the company', async () => {
        const { cookies } = await adminCookies();
        const { company } = await pendingCompany();

        await api()
            .post(`/admin/companies/${company._id}/suspend`)
            .set('Cookie', cookies)
            .send({
                reason: 'inactive',
                internalDescription: 'No activity in twelve months',
                publicDescription: 'Your account is under review',
            });

        const res = await api()
            .post(`/admin/companies/${company._id}/unsuspend`)
            .set('Cookie', cookies)
            .send({ liftReason: 'Owner responded' });

        expect(res.status).toBe(200);
        expect(res.body.data.suspensionDetails.isSuspended).toBe(false);
    });
});

describe('what the rejected company gets to see', () => {
    it('shows the owner the reason but not the reviewer', async () => {
        const { cookies: adminSession } = await adminCookies();
        const { recruiter, company } = await pendingCompany();

        await api()
            .post(`/admin/companies/${company._id}/reject`)
            .set('Cookie', adminSession)
            .send({ reason: 'Website does not resolve' });

        const ownerSession = await login(recruiter.email);
        const res = await api()
            .get('/company/me')
            .set('Cookie', ownerSession);

        expect(res.status).toBe(200);

        // The reason is the whole point of recording it — an owner who cannot
        // read it is no better off than before.
        expect(res.body.data.rejectionReason).toBe('Website does not resolve');

        // Which admin ruled on the application is platform bookkeeping, and
        // naming one to the company they ruled on invites them to be lobbied.
        expect(res.body.data.rejectedBy).toBeUndefined();
    });
});
