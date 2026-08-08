import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, cookieValue, login } from '../helpers/api';
import { createCandidate, createUser, TEST_PASSWORD } from '../helpers/factories';
import { lastEmailTo, testInbox, tokenFromLastEmailTo } from '../helpers/email';
import { User } from '../../src/models/user.model';
import { VerificationToken } from '../../src/models/verificationToken.model';
import { VerificationTokenType } from '../../src/constants/enums';
import { hashToken } from '../../src/utils/hashToken';
import { issueToken } from '../../src/services/verificationToken.service';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

const NEW_PASSWORD = 'BrandNewPassword456!';
const PROTECTED = '/applications/me';

/** Ask for a reset and return the token that arrived in the email. */
const requestReset = async (email: string): Promise<string> => {
    const res = await api().post('/auth/forgot-password').send({ email });
    expect(res.status).toBe(HTTP_STATUS.OK);

    return tokenFromLastEmailTo(email);
};

describe('POST /auth/forgot-password', () => {
    it('emails a reset link to a registered address', async () => {
        const user = await createUser({ email: 'ada@example.com' });

        const res = await api()
            .post('/auth/forgot-password')
            .send({ email: user.email });

        expect(res.status).toBe(HTTP_STATUS.OK);

        const email = lastEmailTo(user.email);
        expect(email.subject).toMatch(/reset/i);
        expect(email.text).toContain('/reset-password?token=');
    });

    it('answers an unknown address exactly as it answers a known one', async () => {
        const user = await createUser({ email: 'ada@example.com' });

        const known = await api()
            .post('/auth/forgot-password')
            .send({ email: user.email });

        const unknown = await api()
            .post('/auth/forgot-password')
            .send({ email: 'nobody@example.com' });

        // Any difference turns this endpoint into a way to test a list of
        // addresses for accounts.
        expect(unknown.status).toBe(known.status);
        expect(unknown.body.message).toBe(known.body.message);
    });

    it('sends nothing, and stores nothing, for an unknown address', async () => {
        await api()
            .post('/auth/forgot-password')
            .send({ email: 'nobody@example.com' });

        expect(testInbox.all()).toHaveLength(0);
        expect(await VerificationToken.countDocuments({})).toBe(0);
    });

    it('rejects a malformed email with a 400', async () => {
        const res = await api()
            .post('/auth/forgot-password')
            .send({ email: 'not-an-email' });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('retires the previous link when a second one is requested', async () => {
        const user = await createUser({ email: 'ada@example.com' });

        const first = await requestReset(user.email);
        const second = await requestReset(user.email);

        expect(second).not.toBe(first);

        const stale = await api()
            .post('/auth/reset-password')
            .send({ token: first, password: NEW_PASSWORD });

        expect(stale.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('stores only a hash of the token', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        const stored = await VerificationToken.findOne({});

        expect(stored?.tokenHash).not.toBe(token);
        expect(stored?.tokenHash).toBe(hashToken(token));
    });
});

describe('POST /auth/reset-password', () => {
    it('sets the new password so the user can log in with it', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        const res = await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.OK);

        const after = await api()
            .post('/auth/login')
            .send({ email: user.email, password: NEW_PASSWORD });

        expect(after.status).toBe(HTTP_STATUS.OK);
    });

    it('stops the old password from working', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        const res = await api()
            .post('/auth/login')
            .send({ email: user.email, password: TEST_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('signs out sessions that were already open', async () => {
        const user = await createCandidate({ email: 'ada@example.com' });
        const cookies = await login(user.email);

        expect((await api().get(PROTECTED).set('Cookie', cookies)).status).toBe(
            HTTP_STATUS.OK,
        );

        const token = await requestReset(user.email);
        await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        // The whole point of a reset is that someone thinks their account is
        // compromised. Leaving the attacker's access token alive would make it
        // theatre.
        const after = await api().get(PROTECTED).set('Cookie', cookies);
        expect(after.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('kills the refresh token too, not just the access token', async () => {
        const user = await createCandidate({ email: 'ada@example.com' });
        const cookies = await login(user.email);

        const token = await requestReset(user.email);
        await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        // Otherwise the attacker just rotates their way back to a live session.
        const res = await api()
            .post('/auth/refresh-token')
            .set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('clears the cookies on the browser that performed the reset', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        const res = await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        const cookies = res.headers['set-cookie'] as unknown as string[];
        expect(cookieValue(cookies, 'token')).toBeFalsy();
        expect(cookieValue(cookies, 'refreshToken')).toBeFalsy();
    });

    it('marks the email verified, since the link proved inbox control', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        expect(user.isEmailVerified).toBe(false);

        const token = await requestReset(user.email);
        await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        const after = await User.findById(user._id);
        expect(after?.isEmailVerified).toBe(true);
    });

    it('tells the account holder their password changed', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        // This is how someone finds out an attacker who could read their email
        // has taken the account.
        expect(lastEmailTo(user.email).subject).toMatch(/password was changed/i);
    });

    it('refuses to reuse a token that has already been redeemed', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        const replay = await api()
            .post('/auth/reset-password')
            .send({ token, password: 'YetAnotherPassword789!' });

        expect(replay.status).toBe(HTTP_STATUS.BAD_REQUEST);

        // And the replay did not quietly change the password anyway.
        const login2 = await api()
            .post('/auth/login')
            .send({ email: user.email, password: 'YetAnotherPassword789!' });

        expect(login2.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('lets exactly one of two simultaneous uses of a token through', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        // findOneAndDelete matches and removes in one operation, which is what
        // makes single-use hold under a race rather than only in sequence.
        const [first, second] = await Promise.all([
            api()
                .post('/auth/reset-password')
                .send({ token, password: NEW_PASSWORD }),
            api()
                .post('/auth/reset-password')
                .send({ token, password: 'CompetingPassword999!' }),
        ]);

        const statuses = [first.status, second.status].sort();
        expect(statuses).toEqual([HTTP_STATUS.OK, HTTP_STATUS.BAD_REQUEST].sort());
    });

    it('rejects an email-verification token presented here', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const verificationToken = await issueToken(
            user._id,
            VerificationTokenType.EMAIL_VERIFICATION,
        );

        const res = await api()
            .post('/auth/reset-password')
            .send({ token: verificationToken, password: NEW_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);

        // The password is untouched.
        const after = await api()
            .post('/auth/login')
            .send({ email: user.email, password: TEST_PASSWORD });

        expect(after.status).toBe(HTTP_STATUS.OK);
    });

    it('rejects an expired token', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        await VerificationToken.updateOne(
            { tokenHash: hashToken(token) },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );

        const res = await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('rejects a token that was never issued', async () => {
        const res = await api()
            .post('/auth/reset-password')
            .send({ token: 'b'.repeat(64), password: NEW_PASSWORD });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('holds a reset to the same password rules as registration', async () => {
        const user = await createUser({ email: 'ada@example.com' });
        const token = await requestReset(user.email);

        const res = await api()
            .post('/auth/reset-password')
            .send({ token, password: 'short' });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);

        // Rejected at validation, so the token was never spent — the user can
        // try again with a longer password using the link they already have.
        const retry = await api()
            .post('/auth/reset-password')
            .send({ token, password: NEW_PASSWORD });

        expect(retry.status).toBe(HTTP_STATUS.OK);
    });
});
