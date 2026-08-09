// src/services/admin.service.ts
import bcrypt from 'bcrypt';
import { User } from '../models/user.model';
import { RegisterInput } from '../types/auth.types';
import { ENV } from '../config/env';
import { logger } from '../config/logger';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { IUserSafe } from '../types/user.types';
import { sendVerificationEmail } from './auth.service';

/**
 * Create a platform admin user (no profile document — admins have no profile).
 *
 * Returns the user only. Callers are already authenticated admins, so no token
 * is minted here; the new admin logs in through /auth/login like everyone else.
 */
export const registerAdminService = async (
    data: RegisterInput,
): Promise<IUserSafe> => {
    const { name, email, password } = data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'This email is already in use',
        );
    }

    const hashedPassword = await bcrypt.hash(password, ENV.SALTROUNDS);

    const userDocs = await User.create([
        {
            name,
            email,
            password: hashedPassword,
            role: 'admin',
        },
    ]);

    // An existing admin vouched for this address, but nobody has proved they
    // can read it — so it starts unverified like any other account.
    await sendVerificationEmail(userDocs[0]).catch((error) =>
        logger.error(
            { err: error, event: 'email.send_failed', userId: userDocs[0]._id },
            'Verification email failed',
        ),
    );

    const { password: _, ...userSafe } = userDocs[0].toObject();

    return userSafe as IUserSafe;
};
