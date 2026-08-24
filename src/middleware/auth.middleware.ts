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

/**
 * Gate for the handful of actions where the address has to be a real one the
 * caller controls: creating a company, applying to a job, and creating accounts
 * for teammates. Everything else — browsing, profile building, drafting jobs —
 * stays open, so someone who has just signed up still has something to do while
 * they go and find the email.
 *
 * verifyJWT loads the user fresh on every request, so clicking the link lifts
 * this on the very next call; there is no stale session to log out of.
 */
export const requireVerifiedEmail = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    if (!req.user) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    if (!req.user.isEmailVerified) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Verify your email address to continue',
        );
    }

    next();
};
