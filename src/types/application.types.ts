import { Document, Types } from 'mongoose';
import { ApplicationStatus } from '../constants/enums';

export interface ApplicationStatusChange {
    status: ApplicationStatus;
    changedBy: Types.ObjectId;
    changedAt: Date;
    note?: string;
}

export interface IApplication extends Document {
    _id: Types.ObjectId;
    jobId: Types.ObjectId;
    candidateId: Types.ObjectId;
    // Denormalised from the job so every access check and pipeline query can be
    // scoped to one company without a join.
    companyId: Types.ObjectId;
    status: ApplicationStatus;
    // Snapshot: the résumé as it was when they applied. The candidate can
    // replace their profile résumé later; what was submitted must not change.
    resumeUrl: string;
    resumeFileName?: string;
    coverLetter?: string;
    statusHistory: ApplicationStatusChange[];
    createdAt: Date;
    updatedAt: Date;
}
