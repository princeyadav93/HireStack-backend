import { User } from '../models/user.model';
import { RegisterInput } from '../types/auth.types';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import mongoose from 'mongoose';
import { createRecruiterProfile } from '../utils/profileHelper';
import { IUserSafe } from '../types/user.types';

export const registerRecruiterService = async (
    data: RegisterInput,
): Promise<{ user: IUserSafe; token: string }> => {
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

        const { password: _, ...userSafe } = userDocs[0].toObject();

        return { user: userSafe as IUserSafe, token };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
