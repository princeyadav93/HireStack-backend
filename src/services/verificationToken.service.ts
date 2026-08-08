import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { VerificationToken } from '../models/verificationToken.model';
import { VerificationTokenType } from '../constants/enums';
import { hashToken } from '../utils/hashToken';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Issuing and redeeming the one-time tokens that go out by email.
 *
 * Deliberately not JWTs. These have to be revocable and single-use, which means
 * server-side state either way — and a signed token that is also stored is just
 * a long random string with extra steps. A random string is shorter in a URL,
 * carries no readable claims, and cannot survive its own deletion.
 */

const TOKEN_TTL_MS: Record<VerificationTokenType, number> = {
    // Long enough to survive a mail queue and a night's sleep.
    [VerificationTokenType.EMAIL_VERIFICATION]: 24 * 60 * 60 * 1000,
    // Short on purpose: this one changes a password, so the window in which a
    // forwarded or archived email is dangerous should be small.
    [VerificationTokenType.PASSWORD_RESET]: 60 * 60 * 1000,
};

// One message for unknown, expired and already-used. Telling them apart would
// confirm that a token was once real, and there is nothing a caller can do
// differently in any of the three cases.
export const INVALID_TOKEN =
    'This link is invalid or has expired. Request a new one.';

/**
 * Mint a token, store only its hash, and hand back the raw value for emailing.
 * This is the one moment the raw token exists — it is not recoverable later.
 *
 * Any outstanding token of the same type is dropped first, so asking for a new
 * link retires the old one instead of leaving a pile of working links behind.
 */
export const issueToken = async (
    userId: Types.ObjectId,
    type: VerificationTokenType,
): Promise<string> => {
    await VerificationToken.deleteMany({ userId, type });

    // 256 bits from the CSPRNG. Guessing is not on the table, which is what
    // lets a plain equality lookup on the hash be the whole check.
    const token = randomBytes(32).toString('hex');

    await VerificationToken.create({
        userId,
        tokenHash: hashToken(token),
        type,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
    });

    return token;
};

/**
 * Redeem a token, returning the user it belongs to. Throws on anything else.
 *
 * `findOneAndDelete` is what makes "single use" true rather than aspirational:
 * it matches and removes in one atomic operation, so two requests arriving with
 * the same token cannot both come away with a document.
 */
export const consumeToken = async (
    token: string,
    type: VerificationTokenType,
): Promise<Types.ObjectId> => {
    const record = await VerificationToken.findOneAndDelete({
        tokenHash: hashToken(token),
        // Without this a password-reset token would verify an email, and an
        // email-verification token — which lives 24× longer — would reset a
        // password.
        type,
    });

    if (!record) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, INVALID_TOKEN);
    }

    // The TTL index sweeps on its own schedule, so expiry is checked here too.
    // The record is already deleted at this point, which is the right outcome
    // for an expired token anyway.
    if (record.expiresAt.getTime() <= Date.now()) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, INVALID_TOKEN);
    }

    return record.userId;
};
