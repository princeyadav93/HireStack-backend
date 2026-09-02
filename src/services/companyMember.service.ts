// src/services/companyMember.service.ts
import mongoose, { Types } from 'mongoose';
import { CompanyMember } from '../models/companyMember.model';
import { ICompanyMember } from '../types/companyMember.types';
import { Company } from '../models/company.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { CompanyRole } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

export const blockMemberService = async (
    memberId: string,
    companyId: string,
): Promise<ICompanyMember> => {
    if (!Types.ObjectId.isValid(memberId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid member ID');
    }

    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const memberObjectId = new Types.ObjectId(memberId);
    const companyObjectId = new Types.ObjectId(companyId);

    const member = await CompanyMember.findOne({
        _id: memberObjectId,
        companyId: companyObjectId,
    });

    if (!member) {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Member not found in company',
        );
    }

    if (!member.status) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Member is already blocked',
        );
    }

    member.status = false;
    await member.save();

    return member;
};

export const unblockMemberService = async (
    memberId: string,
    companyId: string,
): Promise<ICompanyMember> => {
    if (!Types.ObjectId.isValid(memberId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid member ID');
    }

    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const memberObjectId = new Types.ObjectId(memberId);
    const companyObjectId = new Types.ObjectId(companyId);

    const member = await CompanyMember.findOne({
        _id: memberObjectId,
        companyId: companyObjectId,
    });

    if (!member) {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Member not found in company',
        );
    }

    if (member.status) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Member is already active');
    }

    member.status = true;
    await member.save();

    return member;
};

export const getCompanyMembersService = async (
    companyId: string,
    page: number = 1,
    limit: number = 10,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const companyObjectId = new Types.ObjectId(companyId);
    const skip = (page - 1) * limit;

    const total = await CompanyMember.countDocuments({
        companyId: companyObjectId,
        status: true,
    });

    const members = await CompanyMember.find({
        companyId: companyObjectId,
        status: true,
    })
        .populate('userId', 'name email')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);

    return {
        members,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};

/**
 * Removing someone from a company removes the *membership*, not the human.
 *
 * This used to `User.deleteOne` as well, which quietly destroyed evidence:
 * `statusHistory.changedBy` is a `ref: 'User'`, so every pipeline move that
 * person had ever made populated as `null` the moment an unrelated HR action
 * removed them. It also contradicted the rest of the codebase, which
 * soft-deletes companies and jobs precisely so the history survives. Deleting
 * the account itself is a platform-admin concern, not a company one.
 */
const removeMembership = async (
    userId: string,
    companyId: string,
    role: CompanyRole.ADMIN | CompanyRole.RECRUITER,
    label: 'Admin' | 'Recruiter',
) => {
    if (!Types.ObjectId.isValid(userId)) {
        throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Invalid ${label.toLowerCase()} ID`,
        );
    }

    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const userObjectId = new Types.ObjectId(userId);
    const companyObjectId = new Types.ObjectId(companyId);

    // The role is part of the lookup, so neither endpoint can reach an OWNER:
    // the one member a company is never allowed to be left without.
    const membership = await CompanyMember.findOne({
        userId: userObjectId,
        companyId: companyObjectId,
        role,
    }).lean();

    if (!membership) {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            `${label} not found in this company`,
        );
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await CompanyMember.deleteOne({ _id: membership._id }, { session });

            // The profile is the person's, not the company's — keep it and
            // just detach it from the company they no longer belong to.
            await RecruiterProfile.updateOne(
                { user: userObjectId, currentCompanyId: companyObjectId },
                { $set: { currentCompanyId: null } },
                { session },
            );

            // One pipeline update, so the pull and the decrement cannot
            // disagree. `$max` against 1 enforces the floor the schema
            // declares and never applies: `recruiterCount` is `min: 1`, but
            // update operators skip validators, so a bare `$inc: -1` drifts
            // negative instead of erroring.
            await Company.updateOne(
                { _id: companyObjectId },
                [
                    {
                        $set: {
                            members: {
                                $filter: {
                                    input: '$members',
                                    cond: { $ne: ['$$this', userObjectId] },
                                },
                            },
                            recruiterCount: {
                                $max: [
                                    1,
                                    { $subtract: ['$recruiterCount', 1] },
                                ],
                            },
                        },
                    },
                ],
                // Mongoose 9 refuses an array update unless it is told the
                // array is a pipeline and not a mistake.
                { session, updatePipeline: true },
            );
        });
    } finally {
        await session.endSession();
    }
};

export const deleteAdminService = async (
    adminId: string,
    companyId: string,
) => {
    await removeMembership(adminId, companyId, CompanyRole.ADMIN, 'Admin');

    return {
        message: 'Admin removed from the company',
        removedAdminId: adminId,
    };
};

export const deleteRecruiterService = async (
    recruiterId: string,
    companyId: string,
) => {
    await removeMembership(
        recruiterId,
        companyId,
        CompanyRole.RECRUITER,
        'Recruiter',
    );

    return {
        message: 'Recruiter removed from the company',
        removedRecruiterId: recruiterId,
    };
};

export const getCompanyRecruitersService = async (
    companyId: string,
    page: number = 1,
    limit: number = 10,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const companyObjectId = new Types.ObjectId(companyId);
    const skip = (page - 1) * limit;

    const total = await CompanyMember.countDocuments({
        companyId: companyObjectId,
        role: CompanyRole.RECRUITER,
    });

    const recruiters = await CompanyMember.find({
        companyId: companyObjectId,
        role: CompanyRole.RECRUITER,
    })
        .populate('userId', 'name email')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);

    return {
        recruiters,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};
