import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { IUser, User } from '../models/user.model';
import { HTTP_STATUS } from '../constants';

// extend Request to attach user on it
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

export const verifyJWT = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            throw new ApiError(
                HTTP_STATUS.UNAUTHORIZED,
                'Unauthorized - No token provided',
            );
        }

        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };

        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            throw new ApiError(
                HTTP_STATUS.UNAUTHORIZED,
                'Unauthorized - User not found',
            );
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};
