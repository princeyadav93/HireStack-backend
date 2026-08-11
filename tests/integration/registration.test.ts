import { describe, expect, it } from 'vitest';
import { api, cookieValue } from '../helpers/api';
import { useTestDatabase } from '../helpers/db';
import { TEST_PASSWORD } from '../helpers/factories';

/**
 * Registration, exercised through the HTTP endpoint rather than the factories.
 *
 * Every other integration file builds its users with `tests/helpers/factories`,
 * which writes straight through the models on purpose — a test about applying
 * to a job should fail when applying breaks, not when registration does. The
 * cost of that choice is that nothing called `/candidate/register` and then
 * used what it handed back, and a real bug lived in the gap: both registration
 * services minted their session cookie with a bare `jwt.sign({ userId })`,
 * producing a token with no `type` claim. verifyJWT rejected it, so every new
 * user's first authenticated request was a 401.
 *
 * These tests are deliberately about the seam between registering and being
 * logged in, because that is the part the rest of the suite cannot see.
 */

useTestDatabase();

const CANDIDATE = {
    name: 'New Candidate',
    email: 'new-candidate@example.com',
    password: TEST_PASSWORD,
};

const RECRUITER = {
    name: 'New Recruiter',
    email: 'new-recruiter@example.com',
    password: TEST_PASSWORD,
};

describe('POST /candidate/register', () => {
    it('returns a session that actually authenticates', async () => {
        const res = await api().post('/candidate/register').send(CANDIDATE);

        expect(res.status).toBe(201);

        const cookies = res.headers['set-cookie'] as unknown as string[];
        const me = await api().get('/candidate').set('Cookie', cookies);

        // The whole point: the cookie registration set is one the auth
        // middleware accepts.
        expect(me.status).toBe(200);
        expect(me.body.data.email).toBe(CANDIDATE.email);
    });

    it('sets both the access and the refresh cookie', async () => {
        const res = await api().post('/candidate/register').send(CANDIDATE);
        const cookies = res.headers['set-cookie'] as unknown as string[];

        // Without the refresh cookie the session dies when the access token
        // expires, with nothing to rotate against.
        expect(cookieValue(cookies, 'token')).toBeTruthy();
        expect(cookieValue(cookies, 'refreshToken')).toBeTruthy();
    });

    it('can immediately rotate its refresh token', async () => {
        const res = await api().post('/candidate/register').send(CANDIDATE);
        const cookies = res.headers['set-cookie'] as unknown as string[];

        // Proves the refresh token was stored server-side, not just minted:
        // refreshTokenService compares it against the hash on the user record.
        const rotated = await api()
            .post('/auth/refresh-token')
            .set('Cookie', cookies);

        expect(rotated.status).toBe(200);
    });

    it('keeps tokens out of the response body', async () => {
        const res = await api().post('/candidate/register').send(CANDIDATE);

        // They belong in httpOnly cookies and nowhere else — a copy in the body
        // is readable by any script on the page.
        expect(res.body.data.token).toBeUndefined();
        expect(res.body.data.accessToken).toBeUndefined();
        expect(res.body.data.refreshToken).toBeUndefined();
        expect(res.body.data.user.password).toBeUndefined();
    });
});

describe('POST /recruiter/register', () => {
    it('returns a session that actually authenticates', async () => {
        const res = await api().post('/recruiter/register').send(RECRUITER);

        expect(res.status).toBe(201);

        const cookies = res.headers['set-cookie'] as unknown as string[];

        // /candidate is role-agnostic — it only requires a valid access token,
        // so it works as a "does this session resolve to a user" probe here.
        const me = await api().get('/candidate').set('Cookie', cookies);

        expect(me.status).toBe(200);
        expect(me.body.data.email).toBe(RECRUITER.email);
        expect(me.body.data.role).toBe('recruiter');
    });

    it('sets both the access and the refresh cookie', async () => {
        const res = await api().post('/recruiter/register').send(RECRUITER);
        const cookies = res.headers['set-cookie'] as unknown as string[];

        expect(cookieValue(cookies, 'token')).toBeTruthy();
        expect(cookieValue(cookies, 'refreshToken')).toBeTruthy();
    });
});

describe('the session registration issues', () => {
    it('is revoked by logout, like any other session', async () => {
        const res = await api().post('/candidate/register').send(CANDIDATE);
        const cookies = res.headers['set-cookie'] as unknown as string[];

        await api().post('/auth/logout').set('Cookie', cookies).expect(200);

        // Logout bumps tokenVersion. A token minted without that claim would
        // survive this, which is the other half of the original bug.
        const after = await api().get('/candidate').set('Cookie', cookies);

        expect(after.status).toBe(401);
    });

    it('cannot be replayed against the refresh endpoint as an access token', async () => {
        const res = await api().post('/candidate/register').send(CANDIDATE);
        const cookies = res.headers['set-cookie'] as unknown as string[];
        const accessToken = cookieValue(cookies, 'token');

        // The `type` claim is what stops the two being interchangeable when
        // REFRESH_TOKEN_SECRET falls back to JWT_SECRET.
        const replayed = await api()
            .post('/auth/refresh-token')
            .set('Cookie', [`refreshToken=${accessToken}`]);

        expect(replayed.status).toBe(401);
    });
});
