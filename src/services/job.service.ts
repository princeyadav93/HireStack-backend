import { PipelineStage, Types } from 'mongoose';
import { Job } from '../models/job.model';
import { Company } from '../models/company.model';
import { JobStatus } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import { escapeRegex } from '../utils/escapeRegex';
import {
    CreateJobType,
    UpdateJobType,
    JobFilterType,
    CompanyJobFilterType,
} from '../dtos/job.dto';

const assertValidId = (value: string, label: string) => {
    if (!Types.ObjectId.isValid(value)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `Invalid ${label}`);
    }
};

/**
 * Fetch a job and prove it belongs to the caller's company.
 *
 * Every company-side operation goes through here, so a job ID from another
 * tenant reads as "not found" rather than leaking that it exists.
 */
const findOwnedJob = async (jobId: string, companyId: string) => {
    assertValidId(jobId, 'job ID');
    assertValidId(companyId, 'company ID');

    const job = await Job.findOne({
        _id: new Types.ObjectId(jobId),
        companyId: new Types.ObjectId(companyId),
        isArchived: false,
    });

    if (!job) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Job not found');
    }

    return job;
};

/**
 * A company may only be visible to candidates once the platform has approved
 * it. Suspension sets status away from 'approved', so this one check covers
 * approval, rejection and suspension.
 */
const assertCompanyCanPublish = async (companyId: string) => {
    const company = await Company.findById(companyId)
        .select('status isArchived')
        .lean();

    if (!company || company.isArchived) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (company.status !== 'approved') {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            `Your company is ${company.status}. Only approved companies can publish jobs.`,
        );
    }
};

export const createJobService = async (
    data: CreateJobType,
    companyId: string,
    userId: string,
) => {
    assertValidId(companyId, 'company ID');
    assertValidId(userId, 'user ID');

    // Created as a DRAFT regardless of company state — drafting is always
    // allowed, it is publishing that requires approval.
    const job = await Job.create({
        ...data,
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        status: JobStatus.DRAFT,
    });

    return job;
};

export const updateJobService = async (
    jobId: string,
    companyId: string,
    data: UpdateJobType,
) => {
    const job = await findOwnedJob(jobId, companyId);

    if (job.status === JobStatus.CLOSED) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'A closed job cannot be edited',
        );
    }

    Object.assign(job, data);
    await job.save();

    return job;
};

export const publishJobService = async (jobId: string, companyId: string) => {
    const job = await findOwnedJob(jobId, companyId);

    if (job.status === JobStatus.PUBLISHED) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Job is already published',
        );
    }

    if (job.status === JobStatus.CLOSED) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'A closed job cannot be republished',
        );
    }

    await assertCompanyCanPublish(companyId);

    job.status = JobStatus.PUBLISHED;
    job.publishedAt = new Date();
    await job.save();

    return job;
};

export const closeJobService = async (jobId: string, companyId: string) => {
    const job = await findOwnedJob(jobId, companyId);

    if (job.status === JobStatus.CLOSED) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Job is already closed');
    }

    job.status = JobStatus.CLOSED;
    job.closedAt = new Date();
    await job.save();

    return job;
};

/** Soft delete — applications stay readable for audit. */
export const archiveJobService = async (jobId: string, companyId: string) => {
    const job = await findOwnedJob(jobId, companyId);

    job.isArchived = true;
    job.archivedAt = new Date();
    job.status = JobStatus.CLOSED;
    await job.save();

    return { message: 'Job archived successfully', jobId: job._id };
};

export const listCompanyJobsService = async (
    companyId: string,
    filters: CompanyJobFilterType,
    page: number,
    limit: number,
) => {
    assertValidId(companyId, 'company ID');

    const query: Record<string, unknown> = {
        companyId: new Types.ObjectId(companyId),
        isArchived: false,
    };

    if (filters.status) {
        query.status = filters.status;
    }

    if (filters.search) {
        query.title = { $regex: escapeRegex(filters.search), $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
        Job.find(query)
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Job.countDocuments(query),
    ]);

    return {
        jobs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
};

/**
 * Public job board.
 *
 * Runs as an aggregation because visibility depends on the *company's* current
 * state, not just the job's: a company suspended after publishing must drop off
 * the board immediately, without having to rewrite every one of its jobs.
 */
export const listPublicJobsService = async (
    filters: JobFilterType,
    page: number,
    limit: number,
) => {
    const match: Record<string, unknown> = {
        status: JobStatus.PUBLISHED,
        isArchived: false,
    };

    if (filters.employmentType) match.employmentType = filters.employmentType;
    if (filters.workMode) match.workMode = filters.workMode;
    if (filters.city) match['location.city'] = filters.city;
    if (filters.skills?.length) match.skills = { $in: filters.skills };
    if (filters.minExperience !== undefined) {
        match['experience.min'] = { $lte: filters.minExperience };
    }
    if (filters.maxSalary !== undefined) {
        match['salary.min'] = { $lte: filters.maxSalary };
    }
    if (filters.search) {
        const pattern = escapeRegex(filters.search);
        match.$or = [
            { title: { $regex: pattern, $options: 'i' } },
            { skills: { $regex: pattern, $options: 'i' } },
        ];
    }

    const pipeline: PipelineStage[] = [
        { $match: match },
        {
            $lookup: {
                from: 'companies',
                localField: 'companyId',
                foreignField: '_id',
                as: 'company',
            },
        },
        { $unwind: '$company' },
        { $match: { 'company.status': 'approved', 'company.isArchived': false } },
    ];

    const skip = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
        Job.aggregate([
            ...pipeline,
            { $sort: { publishedAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    title: 1,
                    description: 1,
                    employmentType: 1,
                    workMode: 1,
                    location: 1,
                    skills: 1,
                    experience: 1,
                    salary: 1,
                    publishedAt: 1,
                    applicationCount: 1,
                    company: {
                        _id: '$company._id',
                        name: '$company.name',
                        industry: '$company.industry',
                        logo: '$company.logo',
                    },
                },
            },
        ]),
        Job.aggregate([...pipeline, { $count: 'total' }]),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
        jobs: rows,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
};

export const getPublicJobService = async (jobId: string) => {
    assertValidId(jobId, 'job ID');

    const [job] = await Job.aggregate([
        {
            $match: {
                _id: new Types.ObjectId(jobId),
                status: JobStatus.PUBLISHED,
                isArchived: false,
            },
        },
        {
            $lookup: {
                from: 'companies',
                localField: 'companyId',
                foreignField: '_id',
                as: 'company',
            },
        },
        { $unwind: '$company' },
        { $match: { 'company.status': 'approved', 'company.isArchived': false } },
        {
            $project: {
                title: 1,
                description: 1,
                employmentType: 1,
                workMode: 1,
                location: 1,
                skills: 1,
                experience: 1,
                salary: 1,
                publishedAt: 1,
                applicationCount: 1,
                company: {
                    _id: '$company._id',
                    name: '$company.name',
                    industry: '$company.industry',
                    logo: '$company.logo',
                    website: '$company.website',
                },
            },
        },
    ]);

    if (!job) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Job not found');
    }

    return job;
};

/** Company-side detail view, including drafts. */
export const getCompanyJobService = async (
    jobId: string,
    companyId: string,
) => {
    const job = await findOwnedJob(jobId, companyId);
    return job;
};
