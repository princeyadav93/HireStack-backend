import { asyncHandler } from '../utils/asyncHandler';
import { RegisterDTO } from '../dtos/user.dto';
import {
    COOKIE_OPTIONS,
    HTTP_STATUS,
    REFRESH_COOKIE_OPTIONS,
} from '../constants';
import { Request, Response } from 'express';
import { registerRecruiterService } from '../services/recruiter.service';
import { ApiResponse } from '../utils/ApiResponse';

export const registerRecruiterController = asyncHandler(
    async (req: Request, res: Response) => {
        const parsed = RegisterDTO.parse(req.body);

        const { user, accessToken, refreshToken } =
            await registerRecruiterService(parsed);

        // See candidate.controller: both cookies, and the tokens stay out of
        // the response body.
        res.cookie('token', accessToken, COOKIE_OPTIONS);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                { user },
                'Recruiter registered successfully',
            ),
        );
    },
);
