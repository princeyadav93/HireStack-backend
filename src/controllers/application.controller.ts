import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { HTTP_STATUS } from '../constants';
import { getPagination } from '../utils/pagination';
import { getParam } from '../utils/requestParams';
import {
    ApplyToJobDTO,
    UpdateApplicationStatusDTO,
    ApplicationFilterDTO,
} from '../dtos/application.dto';
import {
    applyToJobService,
    listMyApplicationsService,
    listJobApplicationsService,
    listCompanyApplicationsService,
    getApplicationService,
    updateApplicationStatusService,
} from '../services/application.service';

const requireUserId = (req: Request): string => {
    const userId = req.user?._id?.toString();
    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }
    return userId;
};

const requireCompanyId = (req: Request): string => {
    if (!req.companyId) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are not a member of any company',
        );
    }
    return req.companyId;
};

export const applyToJobController = asyncHandler(
    async (req: Request, res: Response) => {
        const candidateId = requireUserId(req);
        const parsed = ApplyToJobDTO.parse(req.body ?? {});

        const application = await applyToJobService(
            getParam(req, 'jobId'),
            candidateId,
            parsed,
        );

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                application,
                'Application submitted successfully',
            ),
        );
    },
);

export const listMyApplicationsController = asyncHandler(
    async (req: Request, res: Response) => {
        const candidateId = requireUserId(req);
        const { page, limit } = getPagination(req.query);
        const filters = ApplicationFilterDTO.parse(req.query);

        const result = await listMyApplicationsService(
            candidateId,
            filters,
            page,
            limit,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'Applications retrieved'),
        );
    },
);

export const listJobApplicationsController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const { page, limit } = getPagination(req.query);
        const filters = ApplicationFilterDTO.parse(req.query);

        const result = await listJobApplicationsService(
            getParam(req, 'jobId'),
            companyId,
            filters,
            page,
            limit,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'Applications retrieved'),
        );
    },
);

/**
 * Serves `GET /company/applications`. It lives with the other application
 * controllers rather than the company ones because what it returns is
 * applications — the company is only the scope, and that scope arrives the same
 * way it does everywhere else, off the membership record.
 */
export const listCompanyApplicationsController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const { page, limit } = getPagination(req.query);
        const filters = ApplicationFilterDTO.parse(req.query);

        const result = await listCompanyApplicationsService(
            companyId,
            filters,
            page,
            limit,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'Applications retrieved'),
        );
    },
);

export const getApplicationController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = requireUserId(req);

        const application = await getApplicationService(
            getParam(req, 'applicationId'),
            userId,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, application, 'Application retrieved'),
        );
    },
);

export const updateApplicationStatusController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = requireCompanyId(req);
        const userId = requireUserId(req);
        const parsed = UpdateApplicationStatusDTO.parse(req.body);

        const application = await updateApplicationStatusService(
            getParam(req, 'applicationId'),
            companyId,
            userId,
            parsed,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                application,
                `Application moved to ${parsed.status}`,
            ),
        );
    },
);
