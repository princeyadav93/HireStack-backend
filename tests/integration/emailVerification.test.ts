import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import { createUser, TEST_PASSWORD } from '../helpers/factories';
import { lastEmailTo, testInbox, tokenFromLastEmailTo } from '../helpers/email';
import { User } from '../../src/models/user.model';
import { VerificationToken } from '../../src/models/verificationToken.model';
import { VerificationTokenType } from '../../src/constants/enums';
import { hashToken } from '../../src/utils/hashToken';
import { issueToken } from '../../src/services/verificationToken.service';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

const NEW_ACCOUNT = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'Password123!',
};

describe('registration → verification email', () => {
    it('emails a verification link to the address that registered', async () => {
        const res = await api().post('/candidate/register').send(NEW_ACCOUNT);

        expect(res.status).toBe(HTTP_STATUS.CREATED);

        const email = lastEmailTo(NEW_ACCOUNT.email);
        expect(email.subject).toMatch(/verify/i);
        expect(email.text).toContain('/verify-email?token=');
    });

    it('starts the account unverified', async () => {
        await api().post('/candidate/register').send(NEW_ACCOUNT);

        const user = await User.findOne({ email: NEW_ACCOUNT.email });
        expect(user?.isEmailVerified).toBe(false);
    });

    it('emails recruiters too, not just candidates', async () => {
        const res = await api().post('/recruiter/register').send(NEW_ACCOUNT);

        expect(res.status).toBe(HTTP_STATUS.CREATED);
        expect(lastEmailTo(NEW_ACCOUNT.email).subject).toMatch(/verify/i);
    });

    it('stores only a hash of the token, never the token itself', async () => {
        await api().post('/candidate/register').send(NEW_ACCOUNT);

        const token = tokenFromLastEmailTo(NEW_ACCOUNT.email);
        const stored = await VerificationToken.findOne({});

        // A leaked backup of this collection must not contain working links.
        expect(stored?.tokenHash).not.toBe(token);
        expect(stored?.tokenHash).toBe(hashToken(token));
    });
});

describe('POST /auth/verify-email', () => {
    it('verifies the account when given the emailed token', async () => {
        await api().post('/candidate/register').send(NEW_ACCOUNT);
        const token = tokenFromLastEmailTo(NEW_ACCOUNT.email);

        const res = await api().post('/auth/verify-email').send({ token });

        expect(res.status).toBe(HTTP_STATUS.OK);

        const user = await User.findOne({ email: NEW_ACCOUNT.email });
        expect(user?.isEmailVerified).toBe(true);
    });

    it('consumes the token, so the same link cannot be replayed', async () => {
        await api().post('/candidate/register').send(NEW_ACCOUNT);
        const token = tokenFromLastEmailTo(NEW_ACCOUNT.email);

        await api().post('/auth/verify-email').send({ token });
        const replay = await api().post('/auth/verify-email').send({ token });

        expect(replay.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('leaves nothing behind in the collection once redeemed', async () => {
        await api().post('/candidate/register').send(NEW_ACCOUNT);
        const token = tokenFromLastEmailTo(NEW_ACCOUNT.email);

        await api().post('/auth/verify-email').send({ token });

        expect(await VerificationToken.countDocuments({})).toBe(0);
    });

    it('rejects a token that was never issued', async () => {
        const res = await api()
            .post('/auth/verify-email')
            .send({ token: 'a'.repeat(64) });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('rejects an empty token with a 400', async () => {
        const res = await api().post('/auth/verify-email').send({ token: '' });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('rejects a password-reset token presented here', async () => {
        const user = await createUser({ isEmailVerified: false });
        const resetToken = await issueToken(
            user._id,
            VerificationTokenType.PASSWORD_RESET,
        );

        // Both types are 32 random bytes in the same collection; only the `type`
        // on the lookup keeps them apart. A reset token is the more dangerous
        // direction, since it would otherwise be redeemable twice over.
        const res = await api()
            .post('/auth/verify-email')
            .send({ token: resetToken });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);

        const after = await User.findById(user._id);
        expect(after?.isEmailVerified).toBe(false);
    });

    it('rejects an expired token even while the row still exists', async () => {
        const user = await createUser({ isEmailVerified: false });
        const token = await issueToken(
            user._id,
            VerificationTokenType.EMAIL_VERIFICATION,
        );

        // Mongo's TTL monitor sweeps roughly once a minute, so an expired token
        // is genuinely still readable for a while. Expiry has to be enforced in
        // code, and this is the window that proves it is.
        await VerificationToken.updateOne(
            { tokenHash: hashToken(token) },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
        );

        const res = await api().post('/auth/verify-email').send({ token });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);

        const after = await User.findById(user._id);
        expect(after?.isEmailVerified).toBe(false);
    });

    it('rejects a valid token whose account has since been deleted', async () => {
        const user = await createUser();
        const token = await issueToken(
            user._id,
            VerificationTokenType.EMAIL_VERIFICATION,
        );

        await user.deleteOne();

        const res = await api().post('/auth/verify-email').send({ token });

        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
});

describe('POST /auth/verify-email/resend', () => {
    it('requires a logged-in user', async () => {
        const res = await api().post('/auth/verify-email/resend');

        expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('sends a fresh link to the logged-in user', async () => {
        const user = await createUser({
            email: 'grace@example.com',
            isEmailVerified: false,
        });
        const cookies = await login(user.email, TEST_PASSWORD);
        testInbox.clear();

        const res = await api()
            .post('/auth/verify-email/resend')
            .set('Cookie', cookies);

        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(lastEmailTo(user.email).subject).toMatch(/verify/i);
    });

    it('retires the previous link when a new one is issued', async () => {
        const user = await createUser({
            email: 'grace@example.com',
            isEmailVerified: false,
        });
        const first = await issueToken(
            user._id,
            VerificationTokenType.EMAIL_VERIFICATION,
        );

        const cookies = await login(user.email, TEST_PASSWORD);
        await api().post('/auth/verify-email/resend').set('Cookie', cookies);

        // Otherwise every "resend" click leaves another working link in an
        // inbox that may later be compromised.
        const res = await api().post('/auth/verify-email').send({ token: first });
        expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    it('keeps only one outstanding token however often it is asked', async () => {
        const user = await createUser({
            email: 'grace@example.com',
            isEmailVerified: false,
        });
        const cookies = await login(user.email, TEST_PASSWORD);

        for (let i = 0; i < 3; i++) {
            await api().post('/auth/verify-email/resend').set('Cookie', cookies);
        }

        expect(
            await VerificationToken.countDocuments({ userId: user._id }),
        ).toBe(1);
    });

    it('sends nothing to an already-verified user but still answers 200', async () => {
        const user = await createUser({
            email: 'grace@example.com',
            isEmailVerified: true,
        });

        const cookies = await login(user.email, TEST_PASSWORD);
        testInbox.clear();

        const res = await api()
            .post('/auth/verify-email/resend')
            .set('Cookie', cookies);

        // Idempotent: a double-clicked button is harmless, and the response
        // does not report state back that the caller could not already read.
        expect(res.status).toBe(HTTP_STATUS.OK);
        expect(testInbox.for(user.email)).toHaveLength(0);
    });
});
