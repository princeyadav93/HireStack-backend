import { Document, Types } from 'mongoose';
import { EmploymentType, JobStatus, WorkMode } from '../constants/enums';

export interface JobLocation {
    city?: string;
    state?: string;
    country?: string;
}

export interface JobSalaryRange {
    min?: number;
    max?: number;
    currency: string;
}

export interface JobExperienceRange {
    min: number;
    max?: number;
}

export interface IJob extends Document {
    _id: Types.ObjectId;
    title: string;
    description: string;
    companyId: Types.ObjectId;
    createdBy: Types.ObjectId;
    employmentType: EmploymentType;
    workMode: WorkMode;
    location?: JobLocation;
    skills: string[];
    experience: JobExperienceRange;
    salary?: JobSalaryRange;
    status: JobStatus;
    publishedAt?: Date;
    closedAt?: Date;
    // Denormalised counter, kept in step with Application inserts inside the
    // same transaction so the list view needs no per-row count query.
    applicationCount: number;
    isArchived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
