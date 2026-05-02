// src/services/admin.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/user.model';
import { RegisterInput } from '../types/auth.types';
import { ENV } from '../config/env';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import mongoose from 'mongoose';
import { IUserSafe } from '../types/user.types';

/**
 * Admin registration service
 * Creates admin user without any profile (testing only)
 */

export const registerAdminService = async (
    data: RegisterInput,
): Promise<{ user: IUserSafe; token: string }> => {
    const { name, email, password } = data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(HTTP_STATUS.ALREADY_EXISTS, 'Admin already exists');
    }

    const hashedPassword = await bcrypt.hash(password, ENV.SALTROUNDS);

    if (!hashedPassword) {
        throw new ApiError(
            HTTP_STATUS.INTERNAL_SERVER,
            'Failed to hash password',
        );
    }

    const userDocs = await User.create([
        {
            name,
            email,
            password: hashedPassword,
            role: 'admin',
        },
    ]);

    const { password: _, ...userSafe } = userDocs[0].toObject();

    const token = jwt.sign({ userId: userSafe._id }, ENV.JWT_SECRET, {
        expiresIn: '1d',
    });

    return { user: userSafe as IUserSafe, token };
};

// export const registerAdminService = async (
//     data: RegisterInput,
// ): Promise<{ user: IUser; token: string }> => {
//     try {
//         const { name, email, password } = data;

//         const existingUser = await User.findOne({ email });
//         if (existingUser) {
//             throw new ApiError(
//                 HTTP_STATUS.ALREADY_EXISTS,
//                 'Admin already exists',
//             );
//         }

//         const hashedPassword = await bcrypt.hash(password, ENV.SALTROUNDS);

//         if (!hashedPassword) {
//             throw new ApiError(
//                 HTTP_STATUS.INTERNAL_SERVER,
//                 'Failed to hash password',
//             );
//         }

//         const userDocs = await User.create([
//             {
//                 name,
//                 email,
//                 password: hashedPassword,
//                 role: 'admin',
//             },
//         ]);

//         const user = userDocs[0];

//         const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
//             expiresIn: '1d',
//         });

//         const userObj = user.toObject();
//         userObj.password = ''; // Hide password in response

//         return { user: userObj, token };
//     } catch (error) {
//         throw error;
//     }
// };
