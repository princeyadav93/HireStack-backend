import { Request, Response, NextFunction } from 'express';
import {
    forgotPasswordService,
    loginService,
    logoutService,
    refreshTokenService,
    resendVerificationEmailService,
    resetPasswordService,
    verifyEmailService,
} from '../services/auth.service';
import {
    COOKIE_OPTIONS,
    HTTP_STATUS,
    REFRESH_COOKIE_OPTIONS,
} from '../constants';
import {
    ForgotPasswordDTO,
    LoginDTO,
    ResetPasswordDTO,
    VerifyEmailDTO,
} from '../dtos/user.dto';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

export const login = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = LoginDTO.parse(req.body);

        const { user, accessToken, refreshToken } = await loginService(parsed);

        res.cookie('token', accessToken, COOKIE_OPTIONS);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, { user }, 'Logged in successfully'),
        );
    },
);

export const logout = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        await logoutService(req.user?._id?.toString());

        res.clearCookie('token', COOKIE_OPTIONS);
        res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, null, 'Logged out successfully'),
        );
    },
);

export const refreshToken = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const incoming = req.cookies?.refreshToken;

        if (!incoming) {
            throw new Error('No refresh token in cookie'); // caught by asyncHandler → errorHandler
        }

        const { accessToken, refreshToken: newRefreshToken } =
            await refreshTokenService(incoming);

        res.cookie('token', accessToken, COOKIE_OPTIONS);
        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, null, 'Token refreshed'),
        );
    },
);

// ─── Email verification ──────────────────────────────────────

export const verifyEmail = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { token } = VerifyEmailDTO.parse(req.body);

        await verifyEmailService(token);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, null, 'Email verified'),
        );
    },
);

export const resendVerificationEmail = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        if (!req.user) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        await resendVerificationEmailService(req.user);

        // Worded to cover the already-verified case too, so the response does
        // not depend on state the caller can already see on their own account.
        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                null,
                'If your email is not yet verified, a new link is on its way',
            ),
        );
    },
);

// ─── Password reset ──────────────────────────────────────────

export const forgotPassword = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { email } = ForgotPasswordDTO.parse(req.body);

        await forgotPasswordService(email);

        // Fixed response, always. Anything that varied with whether the address
        // is registered would let someone test a list of emails against it.
        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                null,
                'If an account exists for that email, a reset link is on its way',
            ),
        );
    },
);

export const resetPassword = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { token, password } = ResetPasswordDTO.parse(req.body);

        await resetPasswordService(token, password);

        // The reset signed every session out, including any this browser held.
        res.clearCookie('token', COOKIE_OPTIONS);
        res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                null,
                'Password updated. Please log in again.',
            ),
        );
    },
);
