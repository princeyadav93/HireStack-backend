import { Request, Response, NextFunction } from 'express';
import { registerCandidateService } from '../services/candidate.service';
import {
    COOKIE_OPTIONS,
    HTTP_STATUS,
    REFRESH_COOKIE_OPTIONS,
} from '../constants';
import { RegisterDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

export const registerCandidate = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = RegisterDTO.parse(req.body);

        const { user, accessToken, refreshToken } =
            await registerCandidateService(parsed);

        // Both cookies, exactly as login sets them — otherwise the session dies
        // the moment the access token expires, with no refresh token to rotate.
        res.cookie('token', accessToken, COOKIE_OPTIONS);
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        // The tokens travel in httpOnly cookies and nowhere else. Echoing them
        // in the body would hand them to any script on the page, which is the
        // one thing httpOnly exists to prevent.
        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                { user },
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
