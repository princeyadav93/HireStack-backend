import { Company } from '../models/company.model';
import { User } from '../models/user.model';
import { CompanyMember } from '../models/companyMember.model';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import mongoose, { Types } from 'mongoose';
import { RecruiterProfile } from '../models/recruiterProfile.model';

/**
 * Get all pending companies
 * Admin only - for company verification/approval
 */
export const getPendingCompaniesService = async () => {
    const pendingCompanies = await Company.find({ status: 'pending' })
        .select('name industry description createdBy createdAt status')
        .populate('createdBy', 'name email')
        .lean();

    return pendingCompanies;
};

/**
 * Approve a pending company
 * Changes status from pending to approved
 */
// src/services/admin.service.ts

export const approveCompanyService = async (companyId: string) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const companyObjectId = new Types.ObjectId(companyId);
    const session = await mongoose.startSession();

    try {
        let approvedCompany;

        await session.withTransaction(async () => {
            const company =
                await Company.findById(companyObjectId).session(session);

            if (!company) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
            }

            if (company.status === 'approved') {
                throw new ApiError(
                    HTTP_STATUS.ALREADY_EXISTS,
                    'Company is already approved',
                );
            }

            if (company.status === 'rejected') {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'Cannot approve a rejected company',
                );
            }

            company.status = 'approved';
            await company.save({ session });

            const ownerProfile = await RecruiterProfile.findOneAndUpdate(
                { user: company.createdBy },
                { isPlatformVerified: true },
                { new: true, runValidators: true, session },
            );

            if (!ownerProfile) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'Owner recruiter profile not found',
                );
            }

            approvedCompany = company;
        });

        if (!approvedCompany) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER,
                'Company approval failed',
            );
        }

        return approvedCompany;
    } finally {
        await session.endSession();
    }
};

/**
 * Reject a pending company
 * Changes status from pending to rejected with optional reason
 */
export const rejectCompanyService = async (
    companyId: string,
    reason?: string,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const company = await Company.findById(companyId);

    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (company.status === 'rejected') {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'Company is already rejected',
        );
    }

    if (company.status === 'approved') {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Cannot reject an approved company',
        );
    }

    company.status = 'rejected';
    await company.save();

    return company;
};

/**
 * Suspend a company for policy violations or fraudulent activity
 * Only platform admin can suspend
 */
export const suspendCompanyService = async (
    companyId: string,
    adminId: string,
    suspensionReason: 'fraudulent_activity' | 'policy_violation' | 'inactive',
    internalDescription: string,
    publicDescription: string,
    appealable: boolean = true,
    appealDays: number = 30,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const companyObjectId = new Types.ObjectId(companyId);
    const session = await mongoose.startSession();

    try {
        let suspendedCompany;

        await session.withTransaction(async () => {
            const company =
                await Company.findById(companyObjectId).session(session);

            if (!company) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
            }

            if (company.suspensionDetails?.isSuspended) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'Company is already suspended',
                );
            }

            if (company.status === 'rejected') {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'Cannot suspend a rejected company',
                );
            }

            company.status = 'suspended';
            company.suspensionDetails = {
                isSuspended: true,
                reason: suspensionReason,
                suspendedAt: new Date(),
                suspendedBy: new Types.ObjectId(adminId),
                internalDescription,
                publicDescription,
                appealable,
                appealDeadline: appealable
                    ? new Date(Date.now() + appealDays * 24 * 60 * 60 * 1000)
                    : undefined,
            };

            await company.save({ session });

            const ownerProfile = await RecruiterProfile.findOneAndUpdate(
                { user: company.createdBy },
                { isPlatformVerified: false },
                { new: true, runValidators: true, session },
            );

            if (!ownerProfile) {
                throw new ApiError(
                    HTTP_STATUS.NOT_FOUND,
                    'Owner recruiter profile not found',
                );
            }

            suspendedCompany = company;
        });

        if (!suspendedCompany) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER,
                'Company suspension failed',
            );
        }

        return suspendedCompany;
    } finally {
        await session.endSession();
    }
};

export const unsuspendCompanyService = async (
    companyId: string,
    adminId: string,
    liftReason: string,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const companyObjectId = new Types.ObjectId(companyId);
    const session = await mongoose.startSession();

    try {
        let unsuspendedCompany;

        await session.withTransaction(async () => {
            const company =
                await Company.findById(companyObjectId).session(session);

            if (!company) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
            }

            if (!company.suspensionDetails?.isSuspended) {
                throw new ApiError(
                    HTTP_STATUS.BAD_REQUEST,
                    'Company is not suspended',
                );
            }

            company.status = 'pending';
            company.suspensionDetails = {
                isSuspended: false,
                reason: undefined,
                suspendedAt: undefined,
                suspendedBy: undefined,
                internalDescription: `Unsuspended by admin ${adminId}: ${liftReason}`,
                publicDescription: undefined,
                appealable: true,
                appealDeadline: undefined,
            };

            await company.save({ session });

            unsuspendedCompany = company;
        });

        if (!unsuspendedCompany) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER,
                'Company unsuspend failed',
            );
        }

        return unsuspendedCompany;
    } finally {
        await session.endSession();
    }
};

/**
 * Get all companies with filters (admin audit view)
 */
export const getCompaniesService = async (filters?: {
    status?: string[];
    createdBy?: string;
    isSuspended?: boolean;
    searchTerm?: string;
}) => {
    const query: Record<string, unknown> = {};

    if (filters?.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
    }

    if (filters?.isSuspended !== undefined) {
        query['suspensionDetails.isSuspended'] = filters.isSuspended;
    }

    if (filters?.createdBy) {
        query.createdBy = filters.createdBy;
    }

    if (filters?.searchTerm) {
        query.$or = [
            { name: { $regex: filters.searchTerm, $options: 'i' } },
            { industry: { $regex: filters.searchTerm, $options: 'i' } },
        ];
    }

    const companies = await Company.find(query)
        .select(
            'name industry status createdBy createdAt suspensionDetails.isSuspended suspensionDetails.reason suspensionDetails.suspendedAt',
        )
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();

    return companies;
};

/**
 * Get all companies (paginated, with filters for platform admin)
 */
export const getAllCompaniesService = async (
    page: number = 1,
    limit: number = 10,
    filters?: {
        status?: string[];
        isSuspended?: boolean;
    },
) => {
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = {};

    if (filters?.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
    }

    if (filters?.isSuspended !== undefined) {
        query['suspensionDetails.isSuspended'] = filters.isSuspended;
    }

    const total = await Company.countDocuments(query);

    const companies = await Company.find(query)
        .select('name industry status createdBy createdAt isArchived')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return {
        companies,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get all users (paginated, filter by role for platform admin)
 */
export const getAllUsersService = async (
    page: number = 1,
    limit: number = 10,
    filters?: {
        role?: string;
    },
) => {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.role) {
        query.role = filters.role;
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return {
        users,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};

/**
 * Soft delete company (PLATFORM ADMIN ONLY)
 * Sets isArchived: true, doesn't hard delete
 */
export const deleteCompanyService = async (companyId: string) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const company = await Company.findById(companyId);

    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (company.isArchived) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Company is already archived',
        );
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            // Soft delete company
            company.isArchived = true;
            company.archivedAt = new Date();
            await company.save({ session });

            // Revoke all members' platform verification
            await RecruiterProfile.updateMany(
                { currentCompanyId: company._id },
                { isPlatformVerified: false },
                { session },
            );
        });

        return {
            message: `Company ${companyId} archived successfully`,
            archivedAt: company.archivedAt,
        };
    } finally {
        await session.endSession();
    }
};

/**
 * Delete user (PLATFORM ADMIN ONLY)
 * Hard delete: removes User, all CompanyMember records, and profile
 */
