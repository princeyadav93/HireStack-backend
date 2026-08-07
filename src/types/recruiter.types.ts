import { Document, Types } from 'mongoose';

/**
 * Recruiter Social Links Type
 */
export interface RecruiterSocialLinks {
    linkedin?: string;
    twitter?: string;
    website?: string;
}

/**
 * Recruiter Profile Image Type
 */
export interface RecruiterProfileImage {
    url?: string;
    fileName?: string;
    uploadedAt?: Date;
}

/**
 * IRecruiterProfile - Recruiter Profile Document Interface
 */
export interface IRecruiterProfile extends Document {
    _id: Types.ObjectId;
    user: Types.ObjectId; // Reference to User model
    currentCompanyId?: Types.ObjectId; // Denormalized current company (from CompanyMember)
    title?: string;
    department?: string;
    bio?: string;
    phone?: string;
    profileImage?: RecruiterProfileImage;
    socialLinks?: RecruiterSocialLinks;
    jobsPosted: number;
    candidatesHired: number;
    isPlatformVerified: boolean; // Whether recruiter is verified by platform
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Recruiter Profile Document Type
 */
export type IRecruiterProfileDocument = IRecruiterProfile & Document;

/**
 * Recruiter Profile Response Type (for API responses)
 */
export interface IRecruiterProfileResponse {
    _id: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    currentCompanyId?: string;
    title?: string;
    department?: string;
    bio?: string;
    phone?: string;
    profileImage?: RecruiterProfileImage;
    socialLinks?: RecruiterSocialLinks;
    jobsPosted: number;
    candidatesHired: number;
    isPlatformVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Recruiter Profile Create Input
 */
export interface RecruiterProfileCreateInput {
    title?: string;
    department?: string;
    bio?: string;
    phone?: string;
    socialLinks?: RecruiterSocialLinks;
}

/**
 * Recruiter Profile Update Input
 */
export interface RecruiterProfileUpdateInput {
    title?: string;
    department?: string;
    bio?: string;
    phone?: string;
    profileImage?: RecruiterProfileImage;
    socialLinks?: RecruiterSocialLinks;
}

/**
 * Recruiter Stats Type
 */
export interface RecruiterStats {
    jobsPosted: number;
    candidatesHired: number;
    companiesCount: number;
    isPlatformVerified: boolean;
}
