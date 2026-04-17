import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompany extends Document {
    name: string;
    industry: string;
    size: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE';
    description?: string;
    website?: string;
    logo?: {
        url?: string;
        fileName?: string;
        uploadedAt?: Date;
    };
    location?: {
        city: string;
        state?: string;
        country: string;
    };
    recruiterCount: number;
    createdBy: mongoose.Types.ObjectId; // First recruiter who created the company
    status: 'pending' | 'approved' | 'rejected';
    members: Types.ObjectId[]; // List of recruiters in the company
    createdAt: Date;
    updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        industry: {
            type: String,
            required: true,
            trim: true,
        },
        size: {
            type: String,
            enum: ['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'],
            default: 'STARTUP',
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        website: {
            type: String,
            match: [/^https?:\/\//, 'Please provide a valid URL'],
        },
        logo: {
            url: String,
            fileName: String,
            uploadedAt: Date,
        },
        location: {
            city: String,
            state: String,
            country: String,
        },
        recruiterCount: {
            type: Number,
            default: 1,
            min: 1,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        members: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    {
        timestamps: true,
    },
);

// Index for faster queries
companySchema.index({ name: 1, createdBy: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
