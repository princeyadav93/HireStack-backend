import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, cookieValue, login } from '../helpers/api';
import { createCandidate, TEST_PASSWORD } from '../helpers/factories';
import { lastEmailTo, testInbox } from '../helpers/email';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/**
 * Changing a password from inside a session.
 *
 * The interesting half is not the password write — it is which sessions
 * survive. A reset ends all of them on purpose, because it is what someone
 * does when they fear compromise. A routine change must end every *other*
 * session and keep the one asking, or the safe habit becomes the one that logs
 * you out of the browser you are typing in.
 */

const NEW_PASSWORD = 'BrandNewPassword456!';

const changePassword = (cookies: string[], body: Record<string, unknown>) =>
    api().post('/auth/change-password').set('Cookie', cookies).send(body);

describe('POST /auth/change-password', () => {
    it('refuses an anonymous caller', async () => {
        const res = await api()
            .post('/auth/change-password')
            .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('changes the password and lets the new one log in', async () => {
        const user = await createCandidate();
        const cookies = await login(user.email);

        const res = await changePassword(cookies, {
            currentPassword: TEST_PASSWORD,
            newPassword: NEW_PASSWORD,
        });

        expect(res.status).toBe(HTTP_STATUS.OK);

        // login() throws on a non-200, so this asserts both halves at once.
        await login(user.email, NEW_PASSWORD);
    });

    it('stops the old password working', async () => {
        const user = await createCandidate();
        const cookies = await login(user.email);

        await changePassword(cookies, {
            currentPassword: TEST_PASSWORD,
            newPassword: NEW_PASSWORD,
        });

        const res = await api()
            .post('/auth/login')
            .send({ email: user.email, password: TEST_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('rejects a wrong current password without changing anything', async () => {
        const user = await createCandidate();
        const cookies = await login(user.email);

        const res = await changePassword(cookies, {
            currentPassword: 'NotTheRightOne123!',
            newPassword: NEW_PASSWORD,
        });

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
        expect(res.body.message).toMatch(/current password is incorrect/i);

        // The account is untouched — the original password still works.
        await login(user.email, TEST_PASSWORD);
    });

    it('rejects a new password identical to the current one', async () => {
        const user = await createCandidate();
        const cookies = await login(user.email);

        const res = await changePassword(cookies, {
            currentPassword: TEST_PASSWORD,
            newPassword: TEST_PASSWORD,
        });

        // Otherwise this revokes every other session and changes nothing.
        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
        expect(res.body.message).toMatch(/must be different/i);
    });

    it('enforces the same length rule as registration', async () => {
        const user = await createCandidate();
        const cookies = await login(user.email);

        const res = await changePassword(cookies, {
            currentPassword: TEST_PASSWORD,
            newPassword: 'short',
        });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
});

describe('which sessions survive a change', () => {
    it('keeps the session that made the change signed in', async () => {
        const user = await createCandidate();
        const cookies = await login(user.email);

        const res = await changePassword(cookies, {
            currentPassword: TEST_PASSWORD,
            newPassword: NEW_PASSWORD,
        });

        // The tokenVersion bump revoked the cookie this request arrived on, so
        // the response has to carry a replacement or the caller is signed out.
        const fresh = res.headers['set-cookie'] as unknown as string[];
        expect(cookieValue(fresh, 'token')).toBeTruthy();
        expect(cookieValue(fresh, 'refreshToken')).toBeTruthy();

        const me = await api().get('/auth/me').set('Cookie', fresh);
        expect(me.status).toBe(HTTP_STATUS.OK);
    });

    it('signs every other device out', async () => {
        const user = await createCandidate();
        const otherDevice = await login(user.email);
        const thisDevice = await login(user.email);

        await changePassword(thisDevice, {
            currentPassword: TEST_PASSWORD,
            newPassword: NEW_PASSWORD,
        });

        const res = await api().get('/auth/me').set('Cookie', otherDevice);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('stops another device refreshing its way back in', async () => {
        const user = await createCandidate();
        const otherDevice = await login(user.email);
        const thisDevice = await login(user.email);

        await changePassword(thisDevice, {
            currentPassword: TEST_PASSWORD,
            newPassword: NEW_PASSWORD,
        });

        // Revoking access tokens alone would leave the stolen refresh token
        // able to mint a new pair, which is the whole session back.
        const res = await api()
            .post('/auth/refresh-token')
            .set('Cookie', otherDevice);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
});

describe('notification', () => {
    it('emails the account owner that the password changed', async () => {
        const user = await createCandidate({ email: 'ada@example.com' });
        const cookies = await login(user.email);
        testInbox.clear();

        await changePassword(cookies, {
            currentPassword: TEST_PASSWORD,
            newPassword: NEW_PASSWORD,
        });

        // Not a courtesy: this is how someone learns their account was taken
        // over by whoever was holding their session.
        expect(lastEmailTo('ada@example.com')).toBeTruthy();
    });
});
