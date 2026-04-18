import { User } from '../models/user.model';
import { IUser } from '../models/user.model';
import { RegisterInput, LoginInput } from '../types/auth.types';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import mongoose from 'mongoose';
import { createRecruiterProfile } from '../utils/profileHelper';

export const registerRecruiterService = async (
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
                'Recruiter already exists',
            );
        }

        const hashedPassword = await bcrypt.hash(password, ENV.SALTROUNDS);

        if (!hashedPassword) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER,
                'Failed to hash password',
            );
        }

        const userDocs = await User.create(
            [
                {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'recruiter',
                },
            ],
            { session },
        );

        const user = userDocs[0];

        // Create recruiter profile on registration
        await createRecruiterProfile(user._id.toString(), session);

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

export const loginRecruiterservice = async (
    data: LoginInput,
): Promise<{ user: IUser; token: string }> => {
    const { email, password } = data;

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
