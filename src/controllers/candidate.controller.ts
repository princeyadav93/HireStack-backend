import { Request, Response, NextFunction } from 'express';
import {
    registerCandidateService,
    loginCandidateService,
} from '../services/candidate.service';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { RegisterDTO, LoginDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';

export const registerCandidate = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = RegisterDTO.parse(req.body);

        const result = await registerCandidateService(parsed);

        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result,
        });
    },
);

export const loginCandidate = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = LoginDTO.parse(req.body);

        const { user, token } = await loginCandidateService(parsed);

        res.cookie('token', token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: { user, token },
        });
    },
);

export const logoutCandidate = asyncHandler(
    async (_req: Request, res: Response, _next: NextFunction) => {
        res.clearCookie('token', COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Logged out successfully',
        });
    },
);

// Backward compatibility exports
export const registerUser = registerCandidate;
export const loginUser = loginCandidate;
export const logoutUser = logoutCandidate;
