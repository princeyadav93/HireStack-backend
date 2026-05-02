import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User, IUser } from '../models/user.model';
import { LoginInput } from '../types/auth.types';
import { ENV } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';

// ─── Helpers ─────────────────────────────────────────────────

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
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid email');
    }

    const isMatch = await user.isPasswordCorrect(password);

    if (!isMatch) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid password');
    }

    const { accessToken, refreshToken } = await generateAndStoreTokens(user);

    user.password = '';

    return { user, accessToken, refreshToken };
};

export const logoutService = async (
    userId: string | undefined,
): Promise<void> => {
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    await User.findByIdAndUpdate(
        userId,
        { $unset: { refreshToken: '' } },
        { new: true, runValidators: true },
    );
};

export const refreshTokenService = async (
    incomingRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
    if (!incomingRefreshToken) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'No refresh token');
    }

    let decoded: { userId: string };

    try {
        decoded = jwt.verify(
            incomingRefreshToken,
            ENV.REFRESH_TOKEN_SECRET,
        ) as { userId: string };
    } catch {
        throw new ApiError(
            HTTP_STATUS.UNAUTHORIZED,
            'Invalid or expired refresh token',
        );
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
