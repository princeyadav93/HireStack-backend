import mongoose, { Types } from 'mongoose';
import { Company } from '../models/company.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { CompanyMember } from '../models/companyMember.model';
import {
    CompanyRole,
    MembershipStatus,
    MembershipSource,
} from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import { CreateCompanyType, JoinCompanyType } from '../dtos/company.dto';

// Escape special regex characters to prevent ReDoS attacks
const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createCompanyService = async (
    data: CreateCompanyType,
    userId: string,
) => {
    const userObjectId = new Types.ObjectId(userId);

    // --- Pre-flight checks (outside transaction — read-only, cheap, fast) ---

    // Check if recruiter already has a company (one company per recruiter)
    const existingCompanyByRecruiter = await Company.findOne({
        createdBy: userObjectId,
    }).lean();

    if (existingCompanyByRecruiter) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'You can only create one company. You have already created a company.',
        );
    }

    // Check if company name already exists globally (escape input to prevent ReDoS)
    const existingCompanyByName = await Company.findOne({
        name: new RegExp(`^${escapeRegex(data.name)}$`, 'i'),
    }).lean();

    if (existingCompanyByName) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'Company with this name already exists.',
        );
    }

    // --- Atomic write: both documents created or neither ---

    const session = await mongoose.startSession();

    try {
        let populatedCompany;

        await session.withTransaction(async () => {
            // Create company inside transaction
            const [company] = await Company.create(
                [
                    {
                        ...data,
                        createdBy: userObjectId,
                        members: [userObjectId],
                        billingAdmin: userObjectId,
                    },
                ],
                { session },
            );

            // Create CompanyMember record (OWNER - auto ACTIVE)
            await CompanyMember.create(
                [
                    {
                        userId: userObjectId,
                        companyId: company._id,
                        role: CompanyRole.OWNER,
                        status: MembershipStatus.ACTIVE,
                        source: MembershipSource.CREATED,
                        approvedBy: userObjectId,
                        approvedAt: new Date(),
                    },
                ],
                { session },
            );

            // Update or create recruiter profile
            await RecruiterProfile.findOneAndUpdate(
                { user: userObjectId },
                { currentCompanyId: company._id },
                { upsert: true, session },
            );

            // Fetch populated doc while still inside the transaction so we return
            // the exact state that was committed (avoids a post-commit race window)
            populatedCompany = await Company.findById(company._id, null, {
                session,
            }).lean();
        });

        return populatedCompany;
    } finally {
        // Always end the session — prevents connection-pool leaks on both
        // success and unexpected throws
        await session.endSession();
    }
};

export const joinCompanyService = async (
    companyId: string,
    userId: string,
    _data?: JoinCompanyType,
) => {
    const userObjectId = new Types.ObjectId(userId);
    const companyObjectId = new Types.ObjectId(companyId);

    // Pre-flight checks
    const company = await Company.findById(companyObjectId).lean();
    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (company.status !== 'approved') {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Only approved companies can accept new members.',
        );
    }

    // Cannot join if already created a company
    if (company.createdBy.equals(userObjectId)) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Cannot join a company you created',
        );
    }

    // Check if already a CompanyMember
    const existingMember = await CompanyMember.findOne({
        userId: userObjectId,
        companyId: companyObjectId,
    });

    if (existingMember) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            `You are already ${existingMember.status} in this company`,
        );
    }

    // Check if recruiter already has another active company
    const recruiterProfile = await RecruiterProfile.findOne({
        user: userObjectId,
        currentCompanyId: { $exists: true, $ne: null },
    });

    if (recruiterProfile) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are already with another company',
        );
    }

    // Create PENDING join request via CompanyMember
    const member = await CompanyMember.create({
        userId: userObjectId,
        companyId: companyObjectId,
        role: CompanyRole.RECRUITER,
        status: MembershipStatus.PENDING,
        source: MembershipSource.REQUEST,
        invitedAt: new Date(),
    });

    return {
        message: 'Join request submitted. Awaiting company approval.',
        member,
    };
};
