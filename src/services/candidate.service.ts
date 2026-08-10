// src/services/candidate.service.ts
import bcrypt from 'bcrypt';
import { User } from '../models/user.model';
import { RegisterInput } from '../types/auth.types';
import { ENV } from '../config/env';
import { logger } from '../config/logger';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { createCandidateProfile } from '../utils/profileHelper';
import { generateAndStoreTokens, sendVerificationEmail } from './auth.service';
import mongoose from 'mongoose';
import { IUserSafe } from '../types/user.types';

export const registerCandidateService = async (
    data: RegisterInput,
): Promise<{
    user: IUserSafe;
    accessToken: string;
    refreshToken: string;
}> => {
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

        // The same pair login issues, from the same helper — registration must
        // leave the caller genuinely logged in, and a hand-rolled token here
        // silently did not.
        const { accessToken, refreshToken } = await generateAndStoreTokens(user);

        const { password: _, ...userSafe } = userDocs[0].toObject();

        return { user: userSafe as IUserSafe, accessToken, refreshToken };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};
