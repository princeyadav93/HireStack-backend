import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Middleware to verify if user is an admin
 * Checks the 'role' field in req.user (set by verifyJWT middleware)
 */
export const verifyAdmin = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    if (!req.user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    if (req.user.role !== 'admin') {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'This action is only allowed for admins',
        );
    }

    next();
};
