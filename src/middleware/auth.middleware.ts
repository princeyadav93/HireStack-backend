import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/user.model';

// extend Request to attach user on it
declare global {
    namespace Express {
        interface Request {
            user?: any;
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
            throw new ApiError(401, 'Unauthorized - No token provided');
        }

        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };

        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            throw new ApiError(401, 'Unauthorized - User not found');
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};
