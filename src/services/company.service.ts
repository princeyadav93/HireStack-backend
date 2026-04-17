import mongoose, { Types } from 'mongoose';
import { Company } from '../models/company.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';
import { CreateCompanyType } from '../dtos/company.dto';

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
                    },
                ],
                { session },
            );

            // Create recruiter profile — only runs if Company.create succeeds
            await RecruiterProfile.create(
                [
                    {
                        user: userObjectId,
                        company: company._id,
                        companyRole: 'owner',
                        isVerified: false,
                    },
                ],
                { session },
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
