import { Document, Types } from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    role: 'candidate' | 'recruiter' | 'admin';
    refreshToken?: string; // hashed, optional (null when logged out)
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
