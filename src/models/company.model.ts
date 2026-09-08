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
        // The review decision, recorded rather than implied. `status` says a
        // company was approved or rejected; on its own it cannot say by whom,
        // when, or what the founder should fix. Both moves are terminal — an
        // approved company cannot be rejected and a rejected one cannot be
        // approved — so nothing later recomputes what is not written here.
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: Date,
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectedAt: Date,
        rejectionReason: {
            type: String,
            trim: true,
            maxlength: 500,
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
