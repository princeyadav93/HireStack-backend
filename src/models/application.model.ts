import mongoose, { Schema } from 'mongoose';
import { IApplication } from '../types/application.types';
import { ApplicationStatus } from '../constants/enums';

const applicationSchema = new Schema<IApplication>(
    {
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'Job',
            required: true,
        },
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(ApplicationStatus),
            default: ApplicationStatus.APPLIED,
        },
        resumeUrl: {
            type: String,
            required: true,
        },
        resumeFileName: String,
        coverLetter: {
            type: String,
            trim: true,
            maxlength: 2000,
        },
        statusHistory: [
            {
                _id: false,
                status: {
                    type: String,
                    enum: Object.values(ApplicationStatus),
                    required: true,
                },
                changedBy: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                changedAt: { type: Date, required: true },
                note: { type: String, trim: true, maxlength: 500 },
            },
        ],
    },
    { timestamps: true },
);

// One application per candidate per job. Enforced by the database rather than a
// read-then-write check, which two concurrent requests can both pass.
applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

// Recruiter pipeline view for one job, and the company-wide funnel.
applicationSchema.index({ jobId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ companyId: 1, status: 1 });

// "My applications" for a candidate.
applicationSchema.index({ candidateId: 1, createdAt: -1 });

export const Application = mongoose.model<IApplication>(
    'Application',
    applicationSchema,
);

export type { IApplication } from '../types/application.types';
