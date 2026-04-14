import { Request, Response, NextFunction } from 'express';
import {
    registerUserService,
    loginUserService,
} from '../services/user.service';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { RegisterDTO, LoginDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';

export const registerUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = RegisterDTO.parse(req.body);

        const result = await registerUserService(parsed);

        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result,
        });
    },
);

export const loginUser = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = LoginDTO.parse(req.body);

        const { user, token } = await loginUserService(parsed);

        res.cookie('token', token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: { user, token },
        });
    },
);

export const logoutUser = asyncHandler(
    async (_req: Request, res: Response, _next: NextFunction) => {
        res.clearCookie('token', COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Logged out successfully',
        });
    },
);
