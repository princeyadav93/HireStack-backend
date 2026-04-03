import { Request, Response, NextFunction } from 'express';
import {
    registerUserService,
    loginUserService,
} from '../services/user.service';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';

export const registerUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        console.log(req.body);
        const { user, token } = await registerUserService(req.body);

        res.cookie('token', token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json(user);
    } catch (err) {
        next(err);
    }
};

export const loginUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { user, token } = await loginUserService(req.body);

        res.cookie('token', token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json(user);
    } catch (err) {
        next(err);
    }
};

export const logoutUser = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        res.clearCookie('token', COOKIE_OPTIONS);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        next(error);
    }
};
