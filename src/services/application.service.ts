import mongoose, { Types } from 'mongoose';
import { Application } from '../models/application.model';
import { Job } from '../models/job.model';
import { Company } from '../models/company.model';
import { CompanyMember } from '../models/companyMember.model';
import { CandidateProfile } from '../models/candidateProfile.model';
import {
    ALLOWED_APPLICATION_TRANSITIONS,
    ApplicationStatus,
    JobStatus,
} from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import {
    ApplyToJobType,
    UpdateApplicationStatusType,
    ApplicationFilterType,
} from '../dtos/application.dto';

const assertValidId = (value: string, label: string) => {
    if (!Types.ObjectId.isValid(value)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Invalid ${label}`);
    }
};

/**
 * Submit an application.
 *
 * The job must be open, its company must still be approved, and the candidate
 * must have a résumé on file — the résumé URL is copied onto the application so
 * later profile edits cannot rewrite what a recruiter already reviewed.
 */
export const applyToJobService = async (
    jobId: string,
    candidateId: string,
    data: ApplyToJobType,
) => {
    assertValidId(jobId, 'job ID');
    assertValidId(candidateId, 'candidate ID');

    const job = await Job.findOne({
        _id: new Types.ObjectId(jobId),
        isArchived: false,
    }).lean();

    if (!job || job.status !== JobStatus.PUBLISHED) {
        // A draft or closed job is indistinguishable from a missing one.
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Job not found or no longer accepting applications',
        );
    }

    const company = await Company.findById(job.companyId)
        .select('status isArchived')
        .lean();

    if (!company || company.isArchived || company.status !== 'approved') {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Job not found or no longer accepting applications',
        );
    }

    const profile = await CandidateProfile.findOne({ user: candidateId })
        .select('resume')
        .lean();

    if (!profile?.resume?.url) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Upload a résumé to your profile before applying',
        );
    }

    const session = await mongoose.startSession();

    try {
        let application;

        await session.withTransaction(async () => {
            const [created] = await Application.create(
                [
                    {
                        jobId: job._id,
                        candidateId: new Types.ObjectId(candidateId),
                        companyId: job.companyId,
                        status: ApplicationStatus.APPLIED,
                        resumeUrl: profile.resume!.url,
                        resumeFileName: (profile.resume as { fileName?: string })
                            .fileName,
                        coverLetter: data.coverLetter,
                        statusHistory: [
                            {
                                status: ApplicationStatus.APPLIED,
                                changedBy: new Types.ObjectId(candidateId),
                                changedAt: new Date(),
                            },
                        ],
                    },
                ],
                { session },
            );

            await Job.updateOne(
                { _id: job._id },
                { $inc: { applicationCount: 1 } },
                { session },
            );

            application = created;
        });

        return application;
    } catch (error: any) {
        // Raced against the unique (jobId, candidateId) index.
        if (error?.code === 11000) {
            throw new ApiError(
                HTTP_STATUS.ALREADY_EXISTS,
                'You have already applied to this job',
            );
        }
        throw error;
    } finally {
        await session.endSession();
    }
};

/** A candidate's own applications, newest first. */
export const listMyApplicationsService = async (
    candidateId: string,
    filters: ApplicationFilterType,
    page: number,
    limit: number,
) => {
    assertValidId(candidateId, 'candidate ID');

    const query: Record<string, unknown> = {
        candidateId: new Types.ObjectId(candidateId),
    };

    if (filters.status) query.status = filters.status;

    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
        Application.find(query)
            .populate('jobId', 'title employmentType workMode location status')
            .populate('companyId', 'name industry logo')
            .select('-statusHistory')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Application.countDocuments(query),
    ]);

    return {
        applications,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
};

/** The recruiter pipeline for one job, scoped to the caller's company. */
export const listJobApplicationsService = async (
    jobId: string,
    companyId: string,
    filters: ApplicationFilterType,
    page: number,
    limit: number,
) => {
    assertValidId(jobId, 'job ID');
    assertValidId(companyId, 'company ID');

    const job = await Job.findOne({
        _id: new Types.ObjectId(jobId),
        companyId: new Types.ObjectId(companyId),
    })
        .select('_id title')
        .lean();

    if (!job) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Job not found');
    }

    const query: Record<string, unknown> = { jobId: job._id };
    if (filters.status) query.status = filters.status;

    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
        Application.find(query)
            .populate('candidateId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Application.countDocuments(query),
    ]);

    return {
        job,
        applications,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
};

/**
 * One application, readable by the candidate who submitted it or by an active
 * member of the company that owns it.
 */
export const getApplicationService = async (
    applicationId: string,
    userId: string,
) => {
    assertValidId(applicationId, 'application ID');
    assertValidId(userId, 'user ID');

    const application = await Application.findById(applicationId)
        .populate('jobId', 'title employmentType workMode location status')
        .populate('candidateId', 'name email')
        .populate('companyId', 'name industry logo')
        .lean();

    if (!application) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Application not found');
    }

    const candidate = application.candidateId as unknown as {
        _id: Types.ObjectId;
    };
    const isOwner = candidate._id.toString() === userId;

    if (isOwner) {
        return application;
    }

    const company = application.companyId as unknown as { _id: Types.ObjectId };
    const membership = await CompanyMember.findOne({
        userId: new Types.ObjectId(userId),
        companyId: company._id,
        status: true,
    }).lean();

    if (!membership) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Application not found');
    }

    return application;
};

/**
 * Move an application through the pipeline.
 *
 * Legal transitions live in ALLOWED_APPLICATION_TRANSITIONS; every change is
 * appended to statusHistory so the decision trail survives.
 */
export const updateApplicationStatusService = async (
    applicationId: string,
    companyId: string,
    userId: string,
    data: UpdateApplicationStatusType,
) => {
    assertValidId(applicationId, 'application ID');
    assertValidId(companyId, 'company ID');
    assertValidId(userId, 'user ID');

    const application = await Application.findOne({
        _id: new Types.ObjectId(applicationId),
        companyId: new Types.ObjectId(companyId),
    });

    if (!application) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Application not found');
    }

    if (application.status === data.status) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Application is already ${data.status}`,
        );
    }

    const allowed = ALLOWED_APPLICATION_TRANSITIONS[application.status] ?? [];

    if (!allowed.includes(data.status)) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            allowed.length
                ? `Cannot move from ${application.status} to ${data.status}. Allowed: ${allowed.join(', ')}`
                : `${application.status} is a final state and cannot be changed`,
        );
    }

    application.status = data.status;
    application.statusHistory.push({
        status: data.status,
        changedBy: new Types.ObjectId(userId),
        changedAt: new Date(),
        note: data.note,
    });

    await application.save();

    return application;
};
