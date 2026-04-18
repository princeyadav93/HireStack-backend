import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
    CreateCompanyDTO,
    JoinCompanyDTO,
    InviteRecruiterDTO,
    ApproveMemberDTO,
    RejectMemberDTO,
    RemoveMemberDTO,
    ChangeMemberRoleDTO,
    DelegateBillingAdminDTO,
} from '../dtos/company.dto';
import {
    createCompanyService,
    joinCompanyService,
} from '../services/company.service';
import {
    inviteRecruiterService,
    approveMemberService,
    rejectMemberService,
    removeMemberService,
    changeMemberRoleService,
    delegateBillingAdminService,
    getCompanyMembersService,
} from '../services/companyMember.service';
import { HTTP_STATUS } from '../constants';
import { CompanyRole } from '../constants/enums';
import { ApiError } from '../utils/ApiError';

/**
 * Create a new company
 * - Only recruiters can create companies
 * - Each recruiter can only create ONE company
 * - Automatically creates recruiter profile as owner with isVerified=false
 */
export const createCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const parsed = CreateCompanyDTO.parse(req.body);
        const company = await createCompanyService(parsed, userId);

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: company,
        });
    },
);

/**
 * Join an existing company
 * - Only recruiters can join companies
 * - Company must be approved status
 * - Recruiter cannot join if they already created a company
 */
export const joinCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        if (!companyId) {
            res.status(400).json({
                success: false,
                message: 'Company ID is required',
            });
            return;
        }

        const parsed = JoinCompanyDTO.parse(req.body || {});
        const result = await joinCompanyService(companyId, userId, parsed);

        res.status(200).json({
            success: true,
            message: 'Successfully submitted join request',
            data: result,
        });
    },
);

/**
 * Invite a recruiter to company
 * - Only OWNER or ADMIN can invite
 */
export const inviteRecruiterController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = InviteRecruiterDTO.parse(req.body);
        const member = await inviteRecruiterService(
            companyId,
            parsed.recruiterId,
            userId,
        );

        res.status(201).json({
            success: true,
            message: 'Recruiter invited successfully',
            data: member,
        });
    },
);

/**
 * Approve pending membership (join request or invitation)
 * - Only OWNER or ADMIN can approve
 */
export const approveMemberController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = ApproveMemberDTO.parse(req.body);
        const member = await approveMemberService(parsed.memberId, userId);

        res.status(200).json({
            success: true,
            message: 'Member approved and added to company',
            data: member,
        });
    },
);

/**
 * Reject pending membership
 * - Only OWNER or ADMIN can reject
 */
export const rejectMemberController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = RejectMemberDTO.parse(req.body);
        const member = await rejectMemberService(
            parsed.memberId,
            userId,
            parsed.reason,
        );

        res.status(200).json({
            success: true,
            message: 'Member application rejected',
            data: member,
        });
    },
);

/**
 * Remove member from company
 * - Only OWNER or ADMIN can remove
 * - Cannot remove last OWNER
 */
export const removeMemberController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = RemoveMemberDTO.parse(req.body);
        const member = await removeMemberService(
            parsed.memberId,
            userId,
            parsed.reason,
        );

        res.status(200).json({
            success: true,
            message: 'Member removed from company',
            data: member,
        });
    },
);

/**
 * Change member role
 * - Only OWNER can change roles
 * - Cannot demote last OWNER
 */
export const changeMemberRoleController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = ChangeMemberRoleDTO.parse(req.body);
        const member = await changeMemberRoleService(
            parsed.memberId,
            parsed.newRole as CompanyRole,
            userId,
        );

        res.status(200).json({
            success: true,
            message: 'Member role updated',
            data: member,
        });
    },
);

/**
 * Get all active members of a company
 * - Any ACTIVE member can view
 */
export const getCompanyMembersController = asyncHandler(
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

        const members = await getCompanyMembersService(companyId);

        res.status(200).json({
            success: true,
            message: 'Company members retrieved',
            data: members,
        });
    },
);

/**
 * Delegate billing admin permissions
 * - Only OWNER can delegate
 */
export const delegateBillingAdminController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const companyId = Array.isArray(req.params.companyId)
            ? req.params.companyId[0]
            : req.params.companyId;

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsed = DelegateBillingAdminDTO.parse(req.body);
        const result = await delegateBillingAdminService(
            companyId,
            parsed.adminId,
        );

        res.status(200).json({
            success: true,
            message: 'Billing admin delegated successfully',
            data: result,
        });
    },
);
