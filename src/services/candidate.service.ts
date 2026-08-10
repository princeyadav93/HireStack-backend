// src/services/candidate.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { RegisterInput } from '../types/auth.types';
import { ENV } from '../config/env';
import { logger } from '../config/logger';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { createCandidateProfile } from '../utils/profileHelper';
import { sendVerificationEmail } from './auth.service';
import mongoose from 'mongoose';
import { IUserSafe } from '../types/user.types';

export const registerCandidateService = async (
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

        await createCandidateProfile(user._id.toString(), session);

        await session.commitTransaction();
        session.endSession();

        // After the commit, and its failure is swallowed: the token lives in
        // another collection, so it has no business inside this transaction,
        // and a mail outage must not undo an account that was created
        // correctly. An unverified user can ask for another link.
        await sendVerificationEmail(user).catch((error) =>
            logger.error(
                { err: error, event: 'email.send_failed', userId: user._id },
                'Verification email failed',
            ),
        );

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
