import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user.model';
import { RegisterInput, LoginInput } from '../types/user.types';
import { ENV } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { createProfileIfNotExists } from './userProfile.service';
import mongoose from 'mongoose';

export const registerUserService = async (
    data: RegisterInput,
): Promise<{ user: IUser; token: string }> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { name, email, password } = data;

        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser) {
            throw new ApiError(
                HTTP_STATUS.ALREADY_EXISTS,
                'User already exists',
            );
        }

        const hashedPassword = await bcrypt.hash(password, ENV.SALTROUNDS);

        const userDocs = await User.create(
            [
                {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'candidate',
                },
            ],
            { session },
        );

        const user = userDocs[0];

        await createProfileIfNotExists(user._id.toString(), session);

        await session.commitTransaction();
        session.endSession();

        const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
            expiresIn: '1d',
        });

        const userObj = user.toObject();
        userObj.password = ''; // Hide password in response

        return { user: userObj, token };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
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
