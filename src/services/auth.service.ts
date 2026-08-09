import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User, IUser } from '../models/user.model';
import { LoginInput, RefreshPayload, TOKEN_TYPE } from '../types/auth.types';
import { ENV } from '../config/env';
import { logger } from '../config/logger';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { hashToken, tokenMatchesHash } from '../utils/hashToken';
import { VerificationTokenType } from '../constants/enums';
import {
    consumeToken,
    INVALID_TOKEN,
    issueToken,
} from './verificationToken.service';
import { OutgoingEmail, sendMail } from './email.service';
import {
    passwordChangedEmail,
    passwordResetEmail,
    verificationEmail,
} from '../utils/emailTemplates';

// ─── Helpers ─────────────────────────────────────────────────

// Compared against when the email does not exist, so a missing account costs
// the same time as a wrong password and cannot be detected by timing.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
    'password-that-never-matches',
    ENV.SALTROUNDS,
);

// Deliberately identical for "no such email" and "wrong password" — a
// different message for each turns login into an account-enumeration oracle.
const INVALID_CREDENTIALS = 'Invalid email or password';

const generateAndStoreTokens = async (
    user: IUser,
): Promise<{ accessToken: string; refreshToken: string }> => {
    const accessToken = user.accessTokenGenerate();
    const refreshToken = user.refreshTokenGenerate();

    // Only the newest token's hash is kept, which is what makes issuing a new
    // one retire the old one.
    await User.findByIdAndUpdate(
        user._id,
        { refreshToken: hashToken(refreshToken) },
        { new: true, runValidators: true },
    );

    return { accessToken, refreshToken };
};

/**
 * Send without letting a mail failure reach the caller.
 *
 * On the account endpoints the response is deliberately identical whether or
 * not an account exists, and a provider outage must not break that: a 500 for
 * real addresses and a 200 for made-up ones is an enumeration oracle built out
 * of error handling. The send is still awaited so behaviour stays deterministic
 * under test.
 */
const sendQuietly = async (email: OutgoingEmail): Promise<void> => {
    try {
        await sendMail(email);
    } catch (error) {
        // Worth alerting on — every failure here is a user who asked for a link
        // and was told one was coming. Logged as a field rather than
        // interpolated into the message so an alert can match on
        // `event: "email.send_failed"` instead of parsing prose.
        logger.error(
            { err: error, event: 'email.send_failed', subject: email.subject },
            'Failed to send email',
        );
    }
};

// ─── Services ────────────────────────────────────────────────

export const loginService = async (
    data: LoginInput,
): Promise<{ user: IUser; accessToken: string; refreshToken: string }> => {
    const { email, password } = data;

    if ([email, password].some((field) => field?.trim() === '')) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'All fields are required');
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, INVALID_CREDENTIALS);
    }

    const isMatch = await user.isPasswordCorrect(password);

    if (!isMatch) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, INVALID_CREDENTIALS);
    }

    const { accessToken, refreshToken } = await generateAndStoreTokens(user);

    return { user, accessToken, refreshToken };
};

export const logoutService = async (
    userId: string | undefined,
): Promise<void> => {
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    // Clearing the refresh token alone would leave the already-issued access
    // token valid until it expires; bumping tokenVersion retires it now.
    await User.findByIdAndUpdate(
        userId,
        { $unset: { refreshToken: '' }, $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true },
    );
};

export const refreshTokenService = async (
    incomingRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
    if (!incomingRefreshToken) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'No refresh token');
    }

    let decoded: RefreshPayload;

    try {
        decoded = jwt.verify(
            incomingRefreshToken,
            ENV.REFRESH_TOKEN_SECRET,
        ) as RefreshPayload;
    } catch {
        throw new ApiError(
            HTTP_STATUS.UNAUTHORIZED,
            'Invalid or expired refresh token',
        );
    }

    // Reject an access token presented here — it would otherwise mint a fresh
    // token pair whenever both secrets are the same value.
    if (decoded.type !== TOKEN_TYPE.REFRESH) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token type');
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || !user.refreshToken) {
        throw new ApiError(
            HTTP_STATUS.UNAUTHORIZED,
            'Session expired, please login again',
        );
    }

    if (!tokenMatchesHash(incomingRefreshToken, user.refreshToken)) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token mismatch');
    }

    const { accessToken, refreshToken } = await generateAndStoreTokens(user);

    return { accessToken, refreshToken };
};

// ─── Email verification ──────────────────────────────────────

/**
 * Issue a verification link and email it. Exported so registration can call it
 * for a user it has just created.
 */
export const sendVerificationEmail = async (user: IUser): Promise<void> => {
    const token = await issueToken(
        user._id,
        VerificationTokenType.EMAIL_VERIFICATION,
    );

    await sendQuietly(verificationEmail(user.email, user.name, token));
};

export const verifyEmailService = async (token: string): Promise<void> => {
    const userId = await consumeToken(
        token,
        VerificationTokenType.EMAIL_VERIFICATION,
    );

    const user = await User.findByIdAndUpdate(userId, {
        $set: { isEmailVerified: true },
    });

    // The token was valid but the account is gone. Same message as a bad token:
    // the caller can do nothing useful with the distinction.
    if (!user) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, INVALID_TOKEN);
    }
};

export const resendVerificationEmailService = async (
    user: IUser,
): Promise<void> => {
    // Already verified: nothing to send, and no error either. Making this
    // idempotent means a double-clicked button is harmless.
    if (user.isEmailVerified) return;

    await sendVerificationEmail(user);
};

// ─── Password reset ──────────────────────────────────────────

/**
 * Start a reset.
 *
 * Returns the same way for a known and an unknown address — the controller
 * sends one fixed response — because a difference here tells an attacker which
 * of a list of emails hold accounts.
 */
export const forgotPasswordService = async (email: string): Promise<void> => {
    const user = await User.findOne({ email });

    if (!user) return;

    const token = await issueToken(
        user._id,
        VerificationTokenType.PASSWORD_RESET,
    );

    await sendQuietly(passwordResetEmail(user.email, user.name, token));
};

/**
 * Finish a reset: set the new password and end every existing session.
 *
 * Signing the other sessions out is the point of the feature, not a nicety. A
 * reset is what someone does when they think their account is compromised, and
 * leaving the attacker's tokens alive would make it theatre.
 */
export const resetPasswordService = async (
    token: string,
    newPassword: string,
): Promise<void> => {
    const userId = await consumeToken(
        token,
        VerificationTokenType.PASSWORD_RESET,
    );

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, INVALID_TOKEN);
    }

    const hashedPassword = await bcrypt.hash(newPassword, ENV.SALTROUNDS);

    await User.findByIdAndUpdate(
        userId,
        {
            $set: {
                password: hashedPassword,
                // Clicking a link sent to that inbox proves control of it just
                // as well as the verification flow does.
                isEmailVerified: true,
            },
            // Drops the stored refresh token so it can no longer be rotated,
            // and retires every access token already issued.
            $unset: { refreshToken: '' },
            $inc: { tokenVersion: 1 },
        },
        { runValidators: true },
    );

    // Not a courtesy: this is how someone finds out their account was taken
    // over by a person who could read their email.
    await sendQuietly(passwordChangedEmail(user.email, user.name));
};
