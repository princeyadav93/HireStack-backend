import { asyncHandler } from '../utils/asyncHandler';
import { RegisterDTO } from '../dtos/user.dto';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { Request, Response } from 'express';
import { registerRecruiterService } from '../services/recruiter.service';
import { ApiResponse } from '../utils/ApiResponse';

export const registerRecruiterController = asyncHandler(
    async (req: Request, res: Response) => {
        const parsed = RegisterDTO.parse(req.body);

        const result = await registerRecruiterService(parsed);

        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                result,
                'Recruiter registered successfully',
            ),
        );
    },
);
