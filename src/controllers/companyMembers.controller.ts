import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
    getCompanyMembersService,
    blockMemberService,
    unblockMemberService,
    getCompanyRecruitersService,
} from '../services/companyMember.service';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';

export const getCompanyMembersController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = req.companyId;

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await getCompanyMembersService(companyId, page, limit);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                result,
                'Company members retrieved',
            ),
        );
    },
);

export const blockMemberController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = req.companyId;
        const memberId = Array.isArray(req.params.memberId)
            ? req.params.memberId[0]
            : req.params.memberId;

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        if (!memberId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Member ID is required',
            );
        }

        const result = await blockMemberService(memberId, companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                result,
                'Member blocked successfully',
            ),
        );
    },
);

export const unblockMemberController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = req.companyId;
        const memberId = Array.isArray(req.params.memberId)
            ? req.params.memberId[0]
            : req.params.memberId;

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        if (!memberId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Member ID is required',
            );
        }

        const result = await unblockMemberService(memberId, companyId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                result,
                'Member unblocked successfully',
            ),
        );
    },
);

export const getCompanyRecruitersController = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = req.companyId;

        if (!companyId) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await getCompanyRecruitersService(
            companyId,
            page,
            limit,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                result,
                'Company recruiters retrieved',
            ),
        );
    },
);
