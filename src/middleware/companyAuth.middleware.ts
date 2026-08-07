// src/middlewares/companyAuth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { CompanyMember } from '../models/companyMember.model';
import { CompanyRole } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import { ICompanyMember } from '../types';

declare global {
    namespace Express {
        interface Request {
            companyMember?: ICompanyMember;
            companyId?: string;
        }
    }
}

export const verifyCompanyMember = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const userId = req.user?._id?.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const member = await CompanyMember.findOne({ userId });

        if (!member) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'You are not a member of any company',
            );
        }

        if (!member.status) {
            throw new ApiError(
                HTTP_STATUS.FORBIDDEN,
                'Your account has been temporarily blocked by the company',
            );
        }

        req.companyMember = member;
        req.companyId = member.companyId.toString();
        next();
    } catch (error) {
        next(error);
    }
};

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
