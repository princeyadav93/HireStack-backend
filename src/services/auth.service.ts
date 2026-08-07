import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User, IUser } from '../models/user.model';
import { LoginInput, RefreshPayload, TOKEN_TYPE } from '../types/auth.types';
import { ENV } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';

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

    const hashed = await bcrypt.hash(refreshToken, ENV.SALTROUNDS);

    await User.findByIdAndUpdate(
        user._id,
        { refreshToken: hashed },
        { new: true, runValidators: true },
    );

    return { accessToken, refreshToken };
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

    const isMatch = await bcrypt.compare(
        incomingRefreshToken,
        user.refreshToken,
    );

    if (!isMatch) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token mismatch');
    }

    const { accessToken, refreshToken } = await generateAndStoreTokens(user);

    return { accessToken, refreshToken };
};
