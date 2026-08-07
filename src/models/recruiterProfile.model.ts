import mongoose, { Schema } from 'mongoose';
import { IRecruiterProfile } from '../types/recruiter.types';

const recruiterProfileSchema = new Schema<IRecruiterProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        currentCompanyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            default: null,
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
    },
    {
        timestamps: true,
    },
);

export const RecruiterProfile = mongoose.model<IRecruiterProfile>(
    'RecruiterProfile',
    recruiterProfileSchema,
);
