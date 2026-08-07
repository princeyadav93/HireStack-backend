import { Request, Response, NextFunction } from 'express';
import { registerCandidateService } from '../services/candidate.service';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { RegisterDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

export const registerCandidate = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = RegisterDTO.parse(req.body);

        const result = await registerCandidateService(parsed);

        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                result,
                'Candidate registered successfully',
            ),
        );
    },
);

export const getCandidateController = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, req.user, 'Candidate retrieved'),
        );
    },
);
