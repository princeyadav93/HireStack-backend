import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
    CreateCompanyDTO,
    CreateAdminDTO,
    CreateRecruiterDTO,
    UpdateCompanyDTO,
    CompanyLogoDTO,
} from '../dtos/company.dto';
import {
    createCompanyService,
    createAdminService,
    createRecruiterService,
    getCompanyService,
    updateCompanyService,
    uploadCompanyLogoService,
} from '../services/companyOwner.service';
import { formatCompanyForRole } from '../utils/formatCompanyResponse';
import {
    deleteAdminService,
    deleteRecruiterService,
} from '../services/companyMember.service';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { getParam } from '../utils/requestParams';

export const createCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = CreateCompanyDTO.parse(req.body);
        const company = await createCompanyService(parsed, userId);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                formatCompanyForRole(company ?? null, req.user!.role),
                'Company created successfully',
            ),
        );
    },
);

export const createAdminController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();
        const companyId = req.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const parsed = CreateAdminDTO.parse(req.body);
        const result = await createAdminService(parsed, companyId, userId);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(HTTP_STATUS.CREATED, result, result.message),
        );
    },
);

export const createRecruiterController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();
        const companyId = req.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const parsed = CreateRecruiterDTO.parse(req.body);
        const result = await createRecruiterService(parsed, userId);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(HTTP_STATUS.CREATED, result, result.message),
        );
    },
);

export const deleteAdminController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();
        const companyId = req.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const adminId = Array.isArray(req.params.adminId)
            ? req.params.adminId[0]
            : req.params.adminId;

        if (!adminId) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Admin ID is required');
        }

        const result = await deleteAdminService(adminId, companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, result.message),
        );
    },
);

export const deleteRecruiterController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();
        const companyId = req.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const recruiterId = Array.isArray(req.params.recruiterId)
            ? req.params.recruiterId[0]
            : req.params.recruiterId;

        if (!recruiterId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Recruiter ID is required',
            );
        }

        const result = await deleteRecruiterService(recruiterId, companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(HTTP_STATUS.OK, result, result.message),
        );
    },
);

export const getCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Company ID is required',
            );
        }

        const company = await getCompanyService(companyId, userId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(company, req.user!.role),
                'Company retrieved successfully',
            ),
        );
    },
);

/**
 * GET /company/me — the caller's own company, without having to know its id.
 *
 * `req.companyId` is read off the membership record by `verifyCompanyMember`,
 * so this is the one company read with no id in the request to tamper with.
 * It also removes the reason a client would ever hold on to a company id: the
 * sibling `GET /:companyId` is the route that has to re-check ownership,
 * precisely because its id came from outside.
 */
export const getMyCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        // verifyCompanyMember sets this or throws, so a miss means the route
        // was wired without it — not anything the caller did.
        if (!req.companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const company = await getCompanyService(req.companyId, userId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(company, req.user!.role),
                'Company retrieved successfully',
            ),
        );
    },
);

export const updateCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Company ID is required',
            );
        }

        // Set by verifyCompanyMember from the caller's membership record.
        if (!req.companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const parsed = UpdateCompanyDTO.parse(req.body);
        const updated = await updateCompanyService(
            companyId,
            userId,
            parsed,
            req.companyId,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(updated, req.user!.role),
                'Company updated successfully',
            ),
        );
    },
);

export const uploadCompanyLogoController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = getParam(req, 'companyId');

        // Set by verifyCompanyMember from the caller's membership record.
        if (!req.companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        if (!req.file) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No logo uploaded');
        }

        // Multer has already parsed the file; the DTO is what decides whether
        // this one is acceptable, keeping the rule in the same place as every
        // other request shape.
        CompanyLogoDTO.parse({ file: req.file });

        const updated = await uploadCompanyLogoService(
            companyId,
            req.file,
            req.companyId,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                formatCompanyForRole(updated, req.user!.role),
                'Company logo updated successfully',
            ),
        );
    },
);
