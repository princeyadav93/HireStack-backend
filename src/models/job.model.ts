import mongoose, { Schema } from 'mongoose';
import { IJob } from '../types/job.types';
import { EmploymentType, JobStatus, WorkMode } from '../constants/enums';

const jobSchema = new Schema<IJob>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 120,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            minlength: 20,
            maxlength: 5000,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        employmentType: {
            type: String,
            enum: Object.values(EmploymentType),
            required: true,
        },
        workMode: {
            type: String,
            enum: Object.values(WorkMode),
            default: WorkMode.ONSITE,
        },
        location: {
            city: { type: String, trim: true, lowercase: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true, lowercase: true },
        },
        skills: [
            {
                type: String,
                trim: true,
                lowercase: true,
            },
        ],
        experience: {
            min: { type: Number, default: 0, min: 0 },
            max: { type: Number, min: 0 },
        },
        salary: {
            min: { type: Number, min: 0 },
            max: { type: Number, min: 0 },
            currency: { type: String, default: 'INR', trim: true },
        },
        status: {
            type: String,
            enum: Object.values(JobStatus),
            default: JobStatus.DRAFT,
        },
        publishedAt: Date,
        closedAt: Date,
        applicationCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
        archivedAt: Date,
    },
    { timestamps: true },
);

// The company's own board: "show me our jobs, newest first, optionally by state".
jobSchema.index({ companyId: 1, status: 1, createdAt: -1 });

// The public board: only PUBLISHED rows are ever served, ordered by publish date.
jobSchema.index({ status: 1, publishedAt: -1 });

// Candidate-facing filters.
jobSchema.index({ skills: 1 });
jobSchema.index({ 'location.city': 1 });
jobSchema.index({ employmentType: 1, workMode: 1 });

export const Job = mongoose.model<IJob>('Job', jobSchema);

export type { IJob } from '../types/job.types';
