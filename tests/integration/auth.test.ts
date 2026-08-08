import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, cookieValue, login } from '../helpers/api';
import { createUser, TEST_PASSWORD } from '../helpers/factories';
import { ENV } from '../../src/config/env';
import { TOKEN_TYPE } from '../../src/types/auth.types';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

// A route that only asks for a valid access token, used to prove a token is
// still accepted (or no longer is).
const PROTECTED = '/applications/me';

describe('POST /auth/login', () => {
    it('returns both cookies and the user on valid credentials', async () => {
        const user = await createUser({ role: 'candidate' });

        const res = await api()
            .post('/auth/login')
            .send({ email: user.email, password: TEST_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.OK);

        const cookies = res.headers['set-cookie'] as unknown as string[];
        expect(cookieValue(cookies, 'token')).toBeTruthy();
        expect(cookieValue(cookies, 'refreshToken')).toBeTruthy();
    });

    it('keeps both cookies httpOnly, so script cannot read them', async () => {
        const user = await createUser();

        const res = await api()
            .post('/auth/login')
            .send({ email: user.email, password: TEST_PASSWORD });

        const cookies = res.headers['set-cookie'] as unknown as string[];

        for (const name of ['token', 'refreshToken']) {
            const cookie = cookies.find((c) => c.startsWith(`${name}=`));
            expect(cookie, `${name} cookie missing`).toMatch(/HttpOnly/i);
        }
    });

    it('never returns the password or refresh token in the body', async () => {
        const user = await createUser();

        const res = await api()
            .post('/auth/login')
            .send({ email: user.email, password: TEST_PASSWORD });

        expect(res.body.data.user).not.toHaveProperty('password');
        expect(res.body.data.user).not.toHaveProperty('refreshToken');
        expect(JSON.stringify(res.body)).not.toContain(TEST_PASSWORD);
    });

    it('answers a wrong password and an unknown email identically', async () => {
        const user = await createUser();

        const wrongPassword = await api()
            .post('/auth/login')
            .send({ email: user.email, password: 'NotThePassword1!' });

        const unknownEmail = await api()
            .post('/auth/login')
            .send({ email: 'nobody@example.com', password: TEST_PASSWORD });

        // Any difference here turns login into an account-enumeration oracle.
        expect(wrongPassword.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(unknownEmail.status).toBe(wrongPassword.status);
        expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('sets no cookies on a failed login', async () => {
        const user = await createUser();

        const res = await api()
            .post('/auth/login')
            .send({ email: user.email, password: 'NotThePassword1!' });

        expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects a malformed body with a 400', async () => {
        const res = await api()
            .post('/auth/login')
            .send({ email: 'not-an-email', password: '' });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
});

describe('access token handling', () => {
    it('rejects a request with no cookie', async () => {
        const res = await api().get(PROTECTED);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('rejects a garbage token', async () => {
        const res = await api().get(PROTECTED).set('Cookie', ['token=nonsense']);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('accepts a freshly issued token', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);

        const res = await api().get(PROTECTED).set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
    });

    it('rejects a correctly signed token for a user who no longer exists', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);

        await user.deleteOne();

        const res = await api().get(PROTECTED).set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('refuses a refresh token presented as an access token', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);
        const refresh = cookieValue(cookies, 'refreshToken');

        // Both secrets are the same value here, matching env.ts's fallback, so
        // this token's signature verifies. Only the `type` claim stands between
        // a long-lived refresh token and full access.
        const res = await api()
            .get(PROTECTED)
            .set('Cookie', [`token=${refresh}`]);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(res.body.message).toMatch(/token type/i);
    });
});

describe('POST /auth/logout', () => {
    it('revokes an access token that was already issued', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);

        // Same token, before and after.
        expect((await api().get(PROTECTED).set('Cookie', cookies)).status).toBe(
            HTTP_STATUS.OK,
        );

        const loggedOut = await api().post('/auth/logout').set('Cookie', cookies);
        expect(loggedOut.status).toBe(HTTP_STATUS.OK);

        // Clearing the cookie alone would leave this token valid for a day.
        // tokenVersion is what actually retires it.
        const after = await api().get(PROTECTED).set('Cookie', cookies);
        expect(after.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('invalidates every session, not just the one that logged out', async () => {
        const user = await createUser({ role: 'candidate' });

        const laptop = await login(user.email);
        const phone = await login(user.email);

        await api().post('/auth/logout').set('Cookie', phone);

        const res = await api().get(PROTECTED).set('Cookie', laptop);
        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
});

describe('POST /auth/refresh-token', () => {
    it('issues a new pair from a valid refresh token', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);

        const res = await api().post('/auth/refresh-token').set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);

        const refreshed = res.headers['set-cookie'] as unknown as string[];
        expect(cookieValue(refreshed, 'token')).toBeTruthy();

        // And the new access token works.
        const after = await api().get(PROTECTED).set('Cookie', refreshed);
        expect(after.status).toBe(HTTP_STATUS.OK);
    });

    it('issues a different refresh token than the one presented', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);

        const rotated = await api()
            .post('/auth/refresh-token')
            .set('Cookie', cookies);
        expect(rotated.status).toBe(HTTP_STATUS.OK);

        const issued = rotated.headers['set-cookie'] as unknown as string[];

        // `iat` has second resolution, so the jti claim is what guarantees this
        // even when both tokens are minted inside the same second.
        expect(cookieValue(issued, 'refreshToken')).not.toBe(
            cookieValue(cookies, 'refreshToken'),
        );
    });

    it('retires the previous refresh token once a new one is issued', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);

        const rotated = await api()
            .post('/auth/refresh-token')
            .set('Cookie', cookies);
        expect(rotated.status).toBe(HTTP_STATUS.OK);

        // Replaying the superseded token must not mint another pair. Only the
        // newest token's hash is stored, and SHA-256 covers the whole token —
        // under bcrypt this passed, because it never read past byte 72.
        const replay = await api()
            .post('/auth/refresh-token')
            .set('Cookie', cookies);

        expect(replay.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('keeps rotating correctly across several refreshes', async () => {
        const user = await createUser({ role: 'candidate' });
        let current = await login(user.email);
        const spent: string[][] = [];

        for (let i = 0; i < 3; i++) {
            const res = await api()
                .post('/auth/refresh-token')
                .set('Cookie', current);

            expect(res.status, `refresh ${i + 1}`).toBe(HTTP_STATUS.OK);

            spent.push(current);
            current = res.headers['set-cookie'] as unknown as string[];
        }

        // Every superseded token is dead, not just the most recent one.
        for (const [i, old] of spent.entries()) {
            const res = await api().post('/auth/refresh-token').set('Cookie', old);
            expect(res.status, `replaying token ${i + 1}`).toBe(
                HTTP_STATUS.UNAUTHORIZED,
            );
        }
    });

    it('refuses an access token presented as a refresh token', async () => {
        const user = await createUser({ role: 'candidate' });
        const cookies = await login(user.email);
        const access = cookieValue(cookies, 'token');

        const res = await api()
            .post('/auth/refresh-token')
            .set('Cookie', [`refreshToken=${access}`]);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(res.body.message).toMatch(/token type/i);
    });

    it('refuses a refresh token signed with the wrong secret', async () => {
        const user = await createUser({ role: 'candidate' });

        const forged = jwt.sign(
            { userId: user._id.toString(), type: TOKEN_TYPE.REFRESH },
            'not-the-real-secret',
            { expiresIn: '10d' },
        );

        const res = await api()
            .post('/auth/refresh-token')
            .set('Cookie', [`refreshToken=${forged}`]);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('refuses a token that is expired even though it is otherwise valid', async () => {
        const user = await createUser({ role: 'candidate' });

        const expired = jwt.sign(
            { userId: user._id.toString(), type: TOKEN_TYPE.REFRESH },
            ENV.REFRESH_TOKEN_SECRET,
            { expiresIn: '-1s' },
        );

        const res = await api()
            .post('/auth/refresh-token')
            .set('Cookie', [`refreshToken=${expired}`]);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
});
