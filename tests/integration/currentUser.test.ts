import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import {
    createCandidate,
    createRecruiterWithCompany,
    createUser,
} from '../helpers/factories';
import { CandidateProfile } from '../../src/models/candidateProfile.model';
import { CompanyMember } from '../../src/models/companyMember.model';
import { CompanyRole } from '../../src/constants/enums';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/**
 * The two "who am I" reads a client makes before it can render anything.
 *
 * The property worth protecting here is that neither takes an id. `/auth/me`
 * reports the membership the API itself authorises against, and `/company/me`
 * resolves the company from that same record — so a client never has to learn
 * a company id, which is how one ends up in a URL where it can be swapped.
 */

describe('GET /auth/me', () => {
    it('refuses an anonymous caller', async () => {
        const res = await api().get('/auth/me');

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('returns a candidate with their profile completion and no membership', async () => {
        const candidate = await createCandidate();
        await CandidateProfile.updateOne(
            { user: candidate._id },
            { $set: { profileCompletion: 40 } },
        );
        const cookies = await login(candidate.email);

        const res = await api().get('/auth/me').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(res.body.data.user.email).toBe(candidate.email);
        expect(res.body.data.user.role).toBe('candidate');
        expect(res.body.data.profileCompletion).toBe(40);
        expect(res.body.data.membership).toBeNull();
    });

    it('returns a recruiter with the membership the API authorises against', async () => {
        const { recruiter, company } = await createRecruiterWithCompany({
            companyName: 'Acme Inc',
            companyStatus: 'pending',
        });
        const cookies = await login(recruiter.email);

        const res = await api().get('/auth/me').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(res.body.data.membership).toMatchObject({
            companyId: company._id.toString(),
            companyName: 'Acme Inc',
            // The UI needs this to explain why publishing is disabled, rather
            // than letting the user find out from a 403.
            companyStatus: 'pending',
            role: CompanyRole.OWNER,
            isActive: true,
        });
        // Nothing computes a completion figure for a recruiter.
        expect(res.body.data.profileCompletion).toBeNull();
    });

    it('reports a blocked member as inactive rather than hiding them', async () => {
        const { recruiter } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email);

        await CompanyMember.updateOne(
            { userId: recruiter._id },
            { $set: { status: false } },
        );

        const res = await api().get('/auth/me').set('Cookie', cookies);

        // The company routes now refuse them, so a client that renders the
        // company section off `membership` alone would show a dead UI.
        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(res.body.data.membership.isActive).toBe(false);
    });

    it('returns a platform admin with neither a membership nor a profile', async () => {
        const admin = await createUser({ role: 'admin' });
        const cookies = await login(admin.email);

        const res = await api().get('/auth/me').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(res.body.data.user.role).toBe('admin');
        expect(res.body.data.membership).toBeNull();
        expect(res.body.data.profileCompletion).toBeNull();
    });

    it('never returns the password, refresh token or token version', async () => {
        const candidate = await createCandidate();
        const cookies = await login(candidate.email);

        const res = await api().get('/auth/me').set('Cookie', cookies);

        expect(res.body.data.user.password).toBeUndefined();
        expect(res.body.data.user.refreshToken).toBeUndefined();
        expect(res.body.data.user.tokenVersion).toBeUndefined();
    });
});

describe('GET /company/me', () => {
    it("returns the caller's own company without being given an id", async () => {
        const { recruiter, company } = await createRecruiterWithCompany({
            companyName: 'Acme Inc',
        });
        const cookies = await login(recruiter.email);

        const res = await api().get('/company/me').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(res.body.data._id).toBe(company._id.toString());
        expect(res.body.data.name).toBe('Acme Inc');
    });

    it('is not swallowed by the /:companyId route it shares a prefix with', async () => {
        // companyOwnerRouter owns `GET /:companyId`, which matches any single
        // segment. If the mount order ever flips, this reads as a lookup for a
        // company whose id is the string "me" and comes back 400.
        const { recruiter } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email);

        const res = await api().get('/company/me').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(res.body.message).not.toMatch(/invalid company id/i);
    });

    it('refuses a caller who belongs to no company', async () => {
        const candidate = await createCandidate();
        const cookies = await login(candidate.email);

        const res = await api().get('/company/me').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
        expect(res.body.message).toMatch(/not a member of any company/i);
    });

    it('refuses an anonymous caller', async () => {
        const res = await api().get('/company/me');

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
});
