import { Document, Types } from 'mongoose';

/**
 * User Type - Base user document in MongoDB
 */
export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    role: 'candidate' | 'recruiter' | 'admin';
    createdAt: Date;
    updatedAt: Date;

    // Custom Mongoose methods
    isPasswordCorrect(password: string): Promise<boolean>;
    accessTokenGenerate(): string;
    refreshTokenGenerate(): string;
}

/**
 * User Document Type (for service/controller responses)
 */
export type IUserDocument = IUser & Document;

/**
 * User Role Enum
 */
export enum UserRole {
    CANDIDATE = 'candidate',
    RECRUITER = 'recruiter',
    ADMIN = 'admin',
}

/**
 * User Public Profile (safe to send to client)
 */
export interface IUserPublic {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    createdAt: Date;
}

/**
 * User with Profile Completion Status
 */
export interface IUserWithProfile extends IUser {
    profileCompletion?: number;
    profileType?: 'candidate' | 'recruiter';
}
