import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { HTTP_STATUS } from '../constants';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { formatCompanyForRole } from '../utils/formatCompanyResponse';
import {
    getPendingCompaniesService,
    approveCompanyService,
    rejectCompanyService,
    suspendCompanyService,
    unsuspendCompanyService,
    getCompaniesService,
    getAllCompaniesService,
    getAllUsersService,
    deleteCompanyService,
} from '../services/platformAdmin.service';

/**
 * Get all pending companies waiting for admin approval
 */
export const getPendingCompaniesController = asyncHandler(
    async (req: Request, res: Response) => {
        const user = req.user!;
        const companies = await getPendingCompaniesService();
        const userRole = user.role;

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(companies, userRole),
                'Pending companies retrieved',
            ),
        );
    },
);

/**
 * Approve a pending company
 */
export const approveCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;
        const user = req.user!;
        const userRole = user.role;

        const company = await approveCompanyService(companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(company, userRole),
                'Company approved successfully',
            ),
        );
    },
);

/**
 * Reject a pending company
 */
export const rejectCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;
        const { reason } = req.body;
        const user = req.user!;
        const userRole = user.role;

        const company = await rejectCompanyService(companyId, reason);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(company, userRole),
                'Company rejected successfully',
            ),
        );
    },
);

/**
 * Suspend a company for policy violations or fraud
 * Body: {
 *   reason: 'fraudulent_activity' | 'policy_violation' | 'inactive',
 *   internalDescription: string (admin notes),
 *   publicDescription: string (what owner sees),
 *   appealable?: boolean (default true),
 *   appealDays?: number (default 30)
 * }
 */
export const suspendCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;
        const {
            reason,
            internalDescription,
            publicDescription,
            appealable = true,
            appealDays = 30,
        } = req.body;

        if (!reason || !internalDescription || !publicDescription) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'reason, internalDescription, and publicDescription are required',
            );
        }
        const user = req.user!;

        const adminId = user._id.toString();
        const userRole = user.role;
        const company = await suspendCompanyService(
            companyId,
            adminId,
            reason,
            internalDescription,
            publicDescription,
            appealable,
            appealDays,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(company, userRole),
                'Company suspended successfully',
            ),
        );
    },
);

/**
 * Unsuspend a company after review
 * Body: { liftReason: string }
 */
export const unsuspendCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;
        const { liftReason } = req.body;

        if (!liftReason) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'liftReason is required',
            );
        }

        const user = req.user!;
        const adminId = user._id.toString();
        const userRole = user.role;
        const company = await unsuspendCompanyService(
            companyId,
            adminId,
            liftReason,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(company, userRole),
                'Company unsuspended successfully - requires manual re-verification',
            ),
        );
    },
);

/**
 * Get all companies with filters (admin audit view)
 * Query params:
 *   status=pending,approved,suspended,rejected (comma-separated)
 *   isSuspended=true/false
 *   searchTerm=string
 */
export const getCompaniesController = asyncHandler(
    async (req: Request, res: Response) => {
        const { status, isSuspended, searchTerm } = req.query;

        const filters = {
            status: status
                ? (status as string).split(',').filter((s) => s.trim())
                : undefined,
            isSuspended: isSuspended ? isSuspended === 'true' : undefined,
            searchTerm: searchTerm as string,
        };

        const companies = await getCompaniesService(filters);
        const user = req.user!;
        const userRole = user.role;

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(companies, userRole),
                'Companies retrieved',
            ),
        );
    },
);

/**
 * Get all companies (paginated, platform admin)
 * Query params:
 *   page=1 (default)
 *   limit=10 (default)
 *   status=pending,approved,suspended,rejected
 *   isSuspended=true/false
 */
export const getAllCompaniesController = asyncHandler(
    async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status
            ? (req.query.status as string).split(',').filter((s) => s.trim())
            : undefined;
        const isSuspended = req.query.isSuspended
            ? req.query.isSuspended === 'true'
            : undefined;

        const result = await getAllCompaniesService(page, limit, {
            status,
            isSuspended,
        });

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'All companies retrieved'),
        );
    },
);

/**
 * Get all users (paginated, platform admin)
 * Query params:
 *   page=1 (default)
 *   limit=10 (default)
 *   role=candidate|recruiter|admin
 */
export const getAllUsersController = asyncHandler(
    async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const role = req.query.role as string;

        const result = await getAllUsersService(page, limit, { role });

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, 'All users retrieved'),
        );
    },
);

/**
 * Delete company (soft delete, platform admin only)
 * Sets isArchived: true, doesn't hard delete
 */
export const deleteCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Company ID is required',
            );
        }

        const result = await deleteCompanyService(companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, result.message),
        );
    },
);
