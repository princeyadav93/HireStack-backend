import { Request, Response, NextFunction } from 'express';
import { CompanyMember } from '../models/companyMember.model';
import { CompanyRole, MembershipStatus } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import mongoose from 'mongoose';

/**
 * Extend Express Request to include company member data
 */
declare global {
    namespace Express {
        interface Request {
            companyMember?: any; // CompanyMember document
            companyId?: string;
        }
    }
}

/**
 * Verify user is an ACTIVE member of the company
 */
export const verifyCompanyMember = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user?.id;
        let companyId = req.params.companyId;

        // Handle case where companyId could be array
        if (Array.isArray(companyId)) {
            companyId = companyId[0];
        }

        if (!userId || !companyId) {
            throw new ApiError(
                HTTP_STATUS.BAD_REQUEST,
                'Missing user or company ID',
            );
        }

        // Convert to ObjectId
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const companyObjectId = new mongoose.Types.ObjectId(companyId);

        const member = await CompanyMember.findOne({
            userId: userObjectId,
            companyId: companyObjectId,
            status: MembershipStatus.ACTIVE,
        });

        if (!member) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not an active member of this company',
            );
        }

        req.companyMember = member;
        req.companyId = companyId as string;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Verify user is OWNER of the company
 */
export const verifyCompanyOwner = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        if (!req.companyMember) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Not verified as company member',
            );
        }

        if (req.companyMember.role !== CompanyRole.OWNER) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Only company owner can perform this action',
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Verify user is OWNER or ADMIN of the company
 */
export const verifyCompanyOwnerOrAdmin = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        if (!req.companyMember) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Not verified as company member',
            );
        }

        if (
            req.companyMember.role !== CompanyRole.OWNER &&
            req.companyMember.role !== CompanyRole.ADMIN
        ) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Only company owner or admin can perform this action',
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Verify user is BILLING_ADMIN (owner or delegated admin)
 */
export const verifyBillingAdmin = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        if (!req.companyMember) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Not verified as company member',
            );
        }

        const { Company } = await import('../models/company.model');
        const company = await Company.findById(req.companyId);

        if (!company) {
            throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
        }

        const userId = req.user?.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Owner is always billing admin, or delegated billing admin
        const isOwner = company.createdBy.equals(userObjectId);
        const isBillingAdmin = company.billingAdmin?.equals(userObjectId);

        if (!isOwner && !isBillingAdmin) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Only billing admin can perform this action',
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};
