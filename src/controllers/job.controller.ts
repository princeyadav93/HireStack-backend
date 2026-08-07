import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { HTTP_STATUS } from '../constants';
import { getPagination } from '../utils/pagination';
import { getParam } from '../utils/requestParams';
import {
    CreateJobDTO,
    UpdateJobDTO,
    JobFilterDTO,
    CompanyJobFilterDTO,
} from '../dtos/job.dto';
import {
    createJobService,
    updateJobService,
    publishJobService,
    closeJobService,
    archiveJobService,
    listCompanyJobsService,
    listPublicJobsService,
    getPublicJobService,
    getCompanyJobService,
} from '../services/job.service';

/** Set by verifyCompanyMember; absent means the guard did not run. */
const requireCompanyId = (req: Request): string => {
    if (!req.companyId) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are not a member of any company',
        );
    }
    return req.companyId;
};

const requireUserId = (req: Request): string => {
    const userId = req.user?._id?.toString();
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }
    return userId;
};

export const createJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const userId = requireUserId(req);

        const parsed = CreateJobDTO.parse(req.body);
        const job = await createJobService(parsed, companyId, userId);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                job,
                'Job created as draft. Publish it when ready.',
            ),
        );
    },
);

export const updateJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const parsed = UpdateJobDTO.parse(req.body);

        const job = await updateJobService(
            getParam(req, 'jobId'),
            companyId,
            parsed,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, job, 'Job updated successfully'),
        );
    },
);

export const publishJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const job = await publishJobService(getParam(req, 'jobId'), companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, job, 'Job published successfully'),
        );
    },
);

export const closeJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const job = await closeJobService(getParam(req, 'jobId'), companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, job, 'Job closed successfully'),
        );
    },
);

export const archiveJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const result = await archiveJobService(getParam(req, 'jobId'), companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, result.message),
        );
    },
);

export const listCompanyJobsController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const { page, limit } = getPagination(req.query);
        const filters = CompanyJobFilterDTO.parse(req.query);

        const result = await listCompanyJobsService(
            companyId,
            filters,
            page,
            limit,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'Company jobs retrieved'),
        );
    },
);

export const getCompanyJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const job = await getCompanyJobService(getParam(req, 'jobId'), companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, job, 'Job retrieved'),
        );
    },
);

// ─── Public (no authentication) ──────────────────────────────────────────

export const listPublicJobsController = asyncHandler(
    async (req: Request, res: Response) => {
        const { page, limit } = getPagination(req.query);
        const filters = JobFilterDTO.parse(req.query);

        const result = await listPublicJobsService(filters, page, limit);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'Jobs retrieved'),
        );
    },
);

export const getPublicJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const job = await getPublicJobService(getParam(req, 'jobId'));

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, job, 'Job retrieved'),
        );
    },
);
