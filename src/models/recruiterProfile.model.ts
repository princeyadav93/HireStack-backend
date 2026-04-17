import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRecruiterProfile extends Document {
    user: Types.ObjectId;
    company?: Types.ObjectId; // Reference to Company model
    title?: string;
    department?: string;
    bio?: string;
    phone?: string;
    profileImage?: {
        url?: string;
        fileName?: string;
        uploadedAt?: Date;
    };
    socialLinks?: {
        linkedin?: string;
        twitter?: string;
        website?: string;
    };
    jobsPosted: number;
    candidatesHired: number;
    createdAt: Date;
    updatedAt: Date;
    companyRole?: 'owner' | 'admin' | 'recruiter'; // Role within the company
    isVerified: boolean; // Whether the recruiter is verified by the platform
}

const recruiterProfileSchema = new Schema<IRecruiterProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        company: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
        },
        title: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        department: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        phone: {
            type: String,
            match: [/^[0-9]{10,}$/, 'Please provide a valid phone number'],
        },
        profileImage: {
            url: String,
            fileName: String,
            uploadedAt: Date,
        },
        socialLinks: {
            linkedin: {
                type: String,
                match: [/linkedin\.com/, 'Invalid LinkedIn URL'],
            },
            twitter: String,
            website: {
                type: String,
                match: [/^https?:\/\//, 'Please provide a valid URL'],
            },
        },
        jobsPosted: {
            type: Number,
            default: 0,
            min: 0,
        },
        candidatesHired: {
            type: Number,
            default: 0,
            min: 0,
        },
        companyRole: {
            type: String,
            enum: ['owner', 'admin', 'recruiter'],
            default: 'recruiter',
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    },
);

export const RecruiterProfile = mongoose.model<IRecruiterProfile>(
    'RecruiterProfile',
    recruiterProfileSchema,
);
