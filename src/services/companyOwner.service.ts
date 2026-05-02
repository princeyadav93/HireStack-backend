import mongoose, { Types, HydratedDocument } from 'mongoose';
import bcrypt from 'bcrypt';
import { Company } from '../models/company.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { CompanyMember } from '../models/companyMember.model';
import { User } from '../models/user.model';
import { IUser } from '../types/user.types';
import { ICompany } from '../types/company.types';
import { CompanyRole } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import {
    CreateCompanyType,
    CreateAdminType,
    CreateRecruiterType,
    UpdateCompanyType,
} from '../dtos/company.dto';
import { ENV } from '../config/env';

const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createCompanyService = async (
    data: CreateCompanyType,
    userId: string,
) => {
    if (!Types.ObjectId.isValid(userId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid user ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    const existingCompanyByRecruiter = await Company.findOne({
        createdBy: userObjectId,
    }).lean();

    if (existingCompanyByRecruiter) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'You can only create one company. You have already created a company.',
        );
    }

    const existingCompanyByName = await Company.findOne({
        name: new RegExp(`^${escapeRegex(data.name)}$`, 'i'),
    }).lean();

    if (existingCompanyByName) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'Company with this name already exists.',
        );
    }

    const session = await mongoose.startSession();

    try {
        let populatedCompany;

        await session.withTransaction(async () => {
            const [company] = await Company.create(
                [
                    {
                        ...data,
                        createdBy: userObjectId,
                        members: [userObjectId],
                    },
                ],
                { session },
            );

            await CompanyMember.create(
                [
                    {
                        userId: userObjectId,
                        companyId: company._id,
                        role: CompanyRole.OWNER,
                        status: true,
                    },
                ],
                { session },
            );

            const existingProfile = await RecruiterProfile.findOne(
                { user: userObjectId },
                null,
                { session },
            );

            if (existingProfile) {
                await RecruiterProfile.updateOne(
                    { user: userObjectId },
                    { currentCompanyId: company._id },
                    { session },
                );
            } else {
                await RecruiterProfile.create(
                    [
                        {
                            user: userObjectId,
                            currentCompanyId: company._id,
                        },
                    ],
                    { session },
                );
            }

            populatedCompany = await Company.findById(company._id, null, {
                session,
            }).lean();
        });

        return populatedCompany as unknown as ICompany;
    } finally {
        await session.endSession();
    }
};

export const createAdminService = async (
    data: CreateAdminType,
    companyId: string,
    ownerId: string,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    if (!Types.ObjectId.isValid(ownerId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid owner ID');
    }

    const companyObjectId = new Types.ObjectId(companyId);

    const existingUser = await User.findOne({ email: data.email }).lean();
    if (existingUser) {
        throw new ApiError(HTTP_STATUS.ALREADY_EXISTS, 'Email already in use');
    }

    const session = await mongoose.startSession();

    try {
        let adminUser: HydratedDocument<IUser> | undefined;
        let adminMember;

        await session.withTransaction(async () => {
            const hashedPassword = await bcrypt.hash(
                data.password,
                ENV.SALTROUNDS,
            );

            const [user] = await User.create(
                [
                    {
                        name: data.name,
                        email: data.email,
                        password: hashedPassword,
                        role: 'recruiter',
                    },
                ],
                { session },
            );

            await RecruiterProfile.create(
                [
                    {
                        user: user._id,
                        currentCompanyId: companyObjectId,
                    },
                ],
                { session },
            );

            const [member] = await CompanyMember.create(
                [
                    {
                        userId: user._id,
                        companyId: companyObjectId,
                        role: CompanyRole.ADMIN,
                        status: true,
                    },
                ],
                { session },
            );

            await Company.findByIdAndUpdate(
                companyObjectId,
                {
                    $push: { members: user._id },
                    $inc: { recruiterCount: 1 },
                },
                { session },
            );

            adminUser = user;
            adminMember = member;
        });

        if (!adminUser) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER,
                'Admin user creation failed',
            );
        }

        const { password: _, ...safeUser } = adminUser.toObject();

        return {
            user: safeUser,
            member: adminMember,
            message: `Admin ${data.email} created successfully`,
        };
    } finally {
        await session.endSession();
    }
};

export const createRecruiterService = async (
    data: CreateRecruiterType,
    creatorId: string,
) => {
    if (!Types.ObjectId.isValid(creatorId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid creator ID');
    }

    const creatorObjectId = new Types.ObjectId(creatorId);

    const existingUser = await User.findOne({ email: data.email }).lean();
    if (existingUser) {
        throw new ApiError(HTTP_STATUS.ALREADY_EXISTS, 'Email already in use');
    }

    const creatorMember = await CompanyMember.findOne({
        userId: creatorObjectId,
        status: true,
    }).lean();

    if (!creatorMember) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are not an active member of any company',
        );
    }

    const companyObjectId = creatorMember.companyId;
    const session = await mongoose.startSession();

    try {
        let recruiterUser: HydratedDocument<IUser> | undefined;
        let recruiterMember;

        await session.withTransaction(async () => {
            const hashedPassword = await bcrypt.hash(
                data.password,
                ENV.SALTROUNDS,
            );

            const [user] = await User.create(
                [
                    {
                        name: data.name,
                        email: data.email,
                        password: hashedPassword,
                        role: 'recruiter',
                    },
                ],
                { session },
            );

            await RecruiterProfile.create(
                [
                    {
                        user: user._id,
                        currentCompanyId: companyObjectId,
                    },
                ],
                { session },
            );

            const [member] = await CompanyMember.create(
                [
                    {
                        userId: user._id,
                        companyId: companyObjectId,
                        role: CompanyRole.RECRUITER,
                        status: true,
                    },
                ],
                { session },
            );

            await Company.findByIdAndUpdate(
                companyObjectId,
                {
                    $push: { members: user._id },
                    $inc: { recruiterCount: 1 },
                },
                { session },
            );

            recruiterUser = user;
            recruiterMember = member;
        });

        if (!recruiterUser) {
            throw new ApiError(
                HTTP_STATUS.INTERNAL_SERVER,
                'Recruiter user creation failed',
            );
        }

        const { password: _, ...safeUser } = recruiterUser.toObject();

        return {
            user: safeUser,
            member: recruiterMember,
            message: `Recruiter ${data.email} created successfully`,
        };
    } finally {
        await session.endSession();
    }
};

export const getCompanyService = async (companyId: string, userId: string) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    if (!Types.ObjectId.isValid(userId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid user ID');
    }

    const company = await Company.findById(companyId)
        .populate('createdBy', 'name email')
        .lean();

    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (company.isArchived) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    return company as unknown as ICompany;
};

export const updateCompanyService = async (
    companyId: string,
    userId: string,
    data: UpdateCompanyType,
) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    if (!Types.ObjectId.isValid(userId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid user ID');
    }

    const company = await Company.findById(companyId).lean();

    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (company.isArchived) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    if (data.name && data.name.toLowerCase() !== company.name.toLowerCase()) {
        const nameExists = await Company.findOne({
            name: new RegExp(`^${escapeRegex(data.name)}$`, 'i'),
            _id: { $ne: new Types.ObjectId(companyId) },
        }).lean();

        if (nameExists) {
            throw new ApiError(
                HTTP_STATUS.ALREADY_EXISTS,
                'Company with this name already exists',
            );
        }
    }

    const updated = await Company.findByIdAndUpdate(
        companyId,
        { $set: data },
        { new: true, runValidators: true },
    )
        .populate('createdBy', 'name email')
        .lean();

    return updated as unknown as ICompany;
};
