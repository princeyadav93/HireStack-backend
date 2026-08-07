// src/services/companyMember.service.ts
import mongoose, { Types } from 'mongoose';
import { CompanyMember } from '../models/companyMember.model';
import { ICompanyMember } from '../types/companyMember.types';
import { Company } from '../models/company.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { User } from '../models/user.model';
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

export const deleteAdminService = async (
    adminId: string,
    companyId: string,
) => {
    if (!Types.ObjectId.isValid(adminId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid admin ID');
    }

    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const adminObjectId = new Types.ObjectId(adminId);
    const companyObjectId = new Types.ObjectId(companyId);

    const admin = await CompanyMember.findOne({
        userId: adminObjectId,
        companyId: companyObjectId,
        role: CompanyRole.ADMIN,
    }).lean();

    if (!admin) {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Admin not found in this company',
        );
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await CompanyMember.deleteOne({ _id: admin._id }, { session });
            await User.deleteOne({ _id: adminObjectId }, { session });
            await RecruiterProfile.deleteOne(
                { user: adminObjectId },
                { session },
            );
            await Company.findByIdAndUpdate(
                companyObjectId,
                {
                    $pull: { members: adminObjectId },
                    $inc: { recruiterCount: -1 },
                },
                { session },
            );
        });

        return {
            message: `Admin deleted successfully`,
            deletedAdminId: adminId,
        };
    } finally {
        await session.endSession();
    }
};

export const deleteRecruiterService = async (
    recruiterId: string,
    companyId: string,
) => {
    if (!Types.ObjectId.isValid(recruiterId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid recruiter ID');
    }

    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const recruiterObjectId = new Types.ObjectId(recruiterId);
    const companyObjectId = new Types.ObjectId(companyId);

    const recruiter = await CompanyMember.findOne({
        userId: recruiterObjectId,
        companyId: companyObjectId,
        role: CompanyRole.RECRUITER,
    }).lean();

    if (!recruiter) {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Recruiter not found in this company',
        );
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await CompanyMember.deleteOne({ _id: recruiter._id }, { session });
            await User.deleteOne({ _id: recruiterObjectId }, { session });
            await RecruiterProfile.deleteOne(
                { user: recruiterObjectId },
                { session },
            );
            await Company.findByIdAndUpdate(
                companyObjectId,
                {
                    $pull: { members: recruiterObjectId },
                    $inc: { recruiterCount: -1 },
                },
                { session },
            );
        });

        return {
            message: `Recruiter deleted successfully`,
            deletedRecruiterId: recruiterId,
        };
    } finally {
        await session.endSession();
    }
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
