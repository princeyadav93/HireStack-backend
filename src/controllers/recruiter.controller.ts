import { asyncHandler } from '../utils/asyncHandler';
import { LoginDTO, RegisterDTO } from '../dtos/user.dto';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { Request, Response } from 'express';
import { registerRecruiterService } from '../services/recruiter.service';
import { loginRecruiterservice } from '../services/recruiter.service';

export const registerRecruiterController = asyncHandler(
    async (req: Request, res: Response) => {
        const parsed = RegisterDTO.parse(req.body);

        const result = await registerRecruiterService(parsed);

        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: result,
        });
    },
);

export const loginRecruiter = asyncHandler(
    async (req: Request, res: Response) => {
        const parsed = LoginDTO.parse(req.body);
        const result = await loginRecruiterservice(parsed);
        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result,
        });
    },
);

export const logoutRecruiter = asyncHandler(
    async (_req: Request, res: Response) => {
        res.clearCookie('token', COOKIE_OPTIONS);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Logged out successfully',
        });
    },
);
