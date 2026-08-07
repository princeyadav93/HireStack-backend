import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { IUser, User } from '../models/user.model';
import { JwtPayload, TOKEN_TYPE } from '../types/auth.types';
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

        const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;

        // A refresh token is signed with a secret that may fall back to
        // JWT_SECRET, so verifying the signature alone is not enough.
        if (decoded.type !== TOKEN_TYPE.ACCESS) {
            throw new ApiError(
                HTTP_STATUS.UNAUTHORIZED,
                'Unauthorized - Invalid token type',
            );
        }

        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            throw new ApiError(
                HTTP_STATUS.UNAUTHORIZED,
                'Unauthorized - User not found',
            );
        }

        // Logout bumps tokenVersion, which retires every token issued before it.
        if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
            throw new ApiError(
                HTTP_STATUS.UNAUTHORIZED,
                'Session expired, please login again',
            );
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};
