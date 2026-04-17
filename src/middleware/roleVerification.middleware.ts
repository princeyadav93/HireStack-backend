import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Middleware to verify if user is a recruiter
 * Checks the 'role' field in req.user (set by verifyJWT middleware)
 */
export const verifyRecruiter = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    if (!req.user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    if (req.user.role !== 'recruiter') {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'This action is only allowed for recruiters',
        );
    }

    next();
};

/**
 * Middleware to verify if user is a candidate
 * Checks the 'role' field in req.user (set by verifyJWT middleware)
 */
export const verifyCandidate = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    if (!req.user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    if (req.user.role !== 'candidate') {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'This action is only allowed for candidates',
        );
    }

    next();
};
