import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { HTTP_STATUS } from '../constants';
import { getCompanyDashboardService } from '../services/companyDashboard.service';

export const getCompanyDashboardController = asyncHandler(
    async (req: Request, res: Response) => {
        // verifyCompanyMember sets this or throws, so a miss means the route
        // was wired without it — not anything the caller did.
        if (!req.companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const dashboard = await getCompanyDashboardService(req.companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, dashboard, 'Dashboard retrieved'),
        );
    },
);
