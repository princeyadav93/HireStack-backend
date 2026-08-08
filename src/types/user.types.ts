import { Document, Types } from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    role: 'candidate' | 'recruiter' | 'admin';
    /** False until a link sent to that address has been clicked. */
    isEmailVerified: boolean;
    refreshToken?: string; // hashed, optional (null when logged out)
    // Bumped on logout so already-issued access tokens stop being accepted.
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;

    isPasswordCorrect(password: string): Promise<boolean>;
    accessTokenGenerate(): string;
    refreshTokenGenerate(): string;
}

export interface IUserSafe {
    _id: Types.ObjectId;
    name: string;
    email: string;
    role: 'candidate' | 'recruiter' | 'admin';
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export enum UserRole {
    CANDIDATE = 'candidate',
    RECRUITER = 'recruiter',
    ADMIN = 'admin',
}

export interface IUserWithProfile extends IUser {
    profileCompletion?: number;
    profileType?: 'candidate' | 'recruiter';
}
