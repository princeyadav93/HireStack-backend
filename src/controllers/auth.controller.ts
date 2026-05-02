import { Request, Response, NextFunction } from 'express';
import {
    loginService,
    logoutService,
    refreshTokenService,
} from '../services/auth.service';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { LoginDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

const REFRESH_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days — matches REFRESH_TOKEN_EXPIRY
};

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
