import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user.model';
import { RegisterInput, LoginInput } from '../types/user.types';
import { ENV } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';

export const registerUserService = async (
    data: RegisterInput,
): Promise<{ user: IUser; token: string }> => {
    const { name, email, password } = data;

    if ([name, email, password].some((fields) => fields?.trim() === '')) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'All fields are required');
    }

    if (password.length < 6) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Password must be at least 6 characters long',
        );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(HTTP_STATUS.ALREADY_EXISTS, 'User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!hashedPassword) {
        throw new ApiError(HTTP_STATUS.INTERNAL_SERVER, 'Something went wrong');
    }

    const user = await User.create({
        name,
        email,
        password: hashedPassword,
    });

    if (!user) {
        throw new ApiError(HTTP_STATUS.INTERNAL_SERVER, 'Something went wrong');
    }

    user.password = ''; // Hide password in response

    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
        expiresIn: '1d',
    });

    return { user, token };
};

export const loginUserService = async (
    data: LoginInput,
): Promise<{ user: IUser; token: string }> => {
    const { email, password } = data;

    if ([email, password].some((fields) => fields?.trim() === '')) {
        throw new Error('All fields are required');
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid email');
    }

    const isMatch = await user.isPasswordCorrect(password);

    if (!isMatch) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid password');
    }

    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
        expiresIn: '1d',
    });

    user.password = ''; // Hide password in response

    return { user, token };
};
