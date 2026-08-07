import mongoose, { Schema } from 'mongoose';
import { ICompany } from '../types/company.types';

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
            enum: ['pending', 'approved', 'rejected', 'suspended'],
            default: 'pending',
        },
        suspensionDetails: {
            isSuspended: {
                type: Boolean,
                default: false,
            },
            reason: {
                type: String,
                enum: ['fraudulent_activity', 'policy_violation', 'inactive'],
                default: null,
            },
            suspendedAt: Date,
            suspendedBy: {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
            internalDescription: String,
            publicDescription: String,
            appealable: {
                type: Boolean,
                default: true,
            },
            appealDeadline: Date,
        },
        members: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        isArchived: {
            type: Boolean,
            default: false,
        },
        archivedAt: Date,
        archivedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    },
);

// Index for faster queries
companySchema.index({ name: 1, createdBy: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
