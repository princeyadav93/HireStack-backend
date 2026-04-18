import mongoose, { Types } from 'mongoose';
import { CompanyMember } from '../models/companyMember.model';
import { Company } from '../models/company.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import {
    CompanyRole,
    MembershipStatus,
    MembershipSource,
} from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Create company and add owner as first member (transaction)
 */
export const createCompanyWithOwnerService = async (
    companyData: any,
    ownerId: string,
) => {
    const ownerObjectId = new Types.ObjectId(ownerId);
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            // 1. Create company
            const company = await Company.create([companyData], { session });
            const companyId = company[0]._id;

            // 2. Create CompanyMember (OWNER - auto ACTIVE)
            await CompanyMember.create(
                [
                    {
                        userId: ownerObjectId,
                        companyId,
                        role: CompanyRole.OWNER,
                        status: MembershipStatus.ACTIVE,
                        source: MembershipSource.CREATED,
                        approvedBy: ownerObjectId,
                        approvedAt: new Date(),
                    },
                ],
                { session },
            );

            // 3. Update Company.members denormalized array
            await Company.findByIdAndUpdate(
                companyId,
                {
                    $set: {
                        members: [ownerObjectId],
                        billingAdmin: ownerObjectId,
                    },
                },
                { session },
            );

            // 4. Update RecruiterProfile.currentCompanyId
            await RecruiterProfile.findOneAndUpdate(
                { user: ownerObjectId },
                { currentCompanyId: companyId },
                { session },
            );

            result = await Company.findById(companyId, null, { session });
        });

        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * Invite recruiter to company (transaction)
 */
export const inviteRecruiterService = async (
    companyId: string,
    recruiterId: string,
    invitedBy: string,
) => {
    const companyObjectId = new Types.ObjectId(companyId);
    const recruiterObjectId = new Types.ObjectId(recruiterId);
    const invitedByObjectId = new Types.ObjectId(invitedBy);

    // Pre-checks
    const company = await Company.findById(companyObjectId);
    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    // Check recruiter exists and is a recruiter (not company owner already)
    const recruiterProfile = await RecruiterProfile.findOne({
        user: recruiterObjectId,
    });
    if (!recruiterProfile) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Recruiter not found');
    }

    // Check if already a member
    const existingMember = await CompanyMember.findOne({
        userId: recruiterObjectId,
        companyId: companyObjectId,
    });

    if (existingMember) {
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            `Recruiter is already ${existingMember.status} in this company`,
        );
    }

    // Create PENDING invitation
    const member = await CompanyMember.create({
        userId: recruiterObjectId,
        companyId: companyObjectId,
        role: CompanyRole.RECRUITER,
        status: MembershipStatus.PENDING,
        source: MembershipSource.INVITE,
        invitedBy: invitedByObjectId,
        invitedAt: new Date(),
    });

    return member;
};

/**
 * Recruiter requests to join approved company
 */
export const requestJoinCompanyService = async (
    companyId: string,
    recruiterId: string,
) => {
    const companyObjectId = new Types.ObjectId(companyId);
    const recruiterObjectId = new Types.ObjectId(recruiterId);

    // Pre-checks
    const company = await Company.findById(companyObjectId);
    if (!company) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Company not found');
    }

    // Company must be verified/approved
    if (company.status !== 'approved') {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Can only join approved companies',
        );
    }

    // Recruiter cannot have active company already
    if (company.createdBy.equals(recruiterObjectId)) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Cannot join a company you created',
        );
    }

    const recruiterCompany = await RecruiterProfile.findOne({
        user: recruiterObjectId,
        currentCompanyId: { $exists: true, $ne: null },
    });

    if (recruiterCompany) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'You are already with another company. Leave first before joining a new one.',
        );
    }

    // Check if already a member
    const existingMember = await CompanyMember.findOne({
        userId: recruiterObjectId,
        companyId: companyObjectId,
    });

    if (existingMember) {
        if (existingMember.status === MembershipStatus.PENDING) {
            throw new ApiError(
                HTTP_STATUS.ALREADY_EXISTS,
                'Your join request is already pending approval',
            );
        }
        throw new ApiError(
            HTTP_STATUS.ALREADY_EXISTS,
            'You are already a member of this company',
        );
    }

    // Create PENDING join request
    const member = await CompanyMember.create({
        userId: recruiterObjectId,
        companyId: companyObjectId,
        role: CompanyRole.RECRUITER,
        status: MembershipStatus.PENDING,
        source: MembershipSource.REQUEST,
        invitedAt: new Date(), // Use for request timestamp
    });

    return member;
};

/**
 * Approve pending join request or invitation (transaction)
 */
export const approveMemberService = async (
    memberId: string,
    approvedBy: string,
) => {
    const memberObjectId = new Types.ObjectId(memberId);
    const approvedByObjectId = new Types.ObjectId(approvedBy);
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const member = await CompanyMember.findById(memberObjectId, null, {
                session,
            });

            if (!member) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Member not found');
            }

            if (member.status !== MembershipStatus.PENDING) {
                throw new ApiError(
                    HTTP_STATUS.FORBIDDEN,
                    `Cannot approve member with status: ${member.status}`,
                );
            }

            // Update CompanyMember
            member.status = MembershipStatus.ACTIVE;
            member.approvedBy = approvedByObjectId;
            member.approvedAt = new Date();
            await member.save({ session });

            // Update Company.members denormalized array
            await Company.findByIdAndUpdate(
                member.companyId,
                {
                    $addToSet: { members: member.userId },
                    $inc: { recruiterCount: 1 },
                },
                { session },
            );

            // Update RecruiterProfile.currentCompanyId
            await RecruiterProfile.findOneAndUpdate(
                { user: member.userId },
                { currentCompanyId: member.companyId },
                { session },
            );

            result = member;
        });

        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * Reject pending join request or invitation
 */
export const rejectMemberService = async (
    memberId: string,
    rejectedBy: string,
    rejectionReason: string,
) => {
    const memberObjectId = new Types.ObjectId(memberId);
    const rejectedByObjectId = new Types.ObjectId(rejectedBy);

    const member = await CompanyMember.findById(memberObjectId);

    if (!member) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Member not found');
    }

    if (member.status !== MembershipStatus.PENDING) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            `Cannot reject member with status: ${member.status}`,
        );
    }

    member.status = MembershipStatus.REJECTED;
    member.rejectedBy = rejectedByObjectId;
    member.rejectedAt = new Date();
    member.rejectionReason = rejectionReason;

    await member.save();
    return member;
};

/**
 * Remove member from company (transaction)
 */
export const removeMemberService = async (
    memberId: string,
    removedBy: string,
    removalReason: string,
) => {
    const memberObjectId = new Types.ObjectId(memberId);
    const removedByObjectId = new Types.ObjectId(removedBy);
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const member = await CompanyMember.findById(memberObjectId, null, {
                session,
            });

            if (!member) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Member not found');
            }

            // Prevent removing last OWNER
            if (member.role === CompanyRole.OWNER) {
                const ownerCount = await CompanyMember.countDocuments(
                    {
                        companyId: member.companyId,
                        role: CompanyRole.OWNER,
                        status: {
                            $in: [
                                MembershipStatus.ACTIVE,
                                MembershipStatus.PENDING,
                            ],
                        },
                    },
                    { session },
                );

                if (ownerCount === 1) {
                    throw new ApiError(
                        HTTP_STATUS.FORBIDDEN,
                        'Cannot remove the last owner of the company',
                    );
                }
            }

            // Update CompanyMember
            member.status = MembershipStatus.REMOVED;
            member.removedBy = removedByObjectId;
            member.removedAt = new Date();
            member.removalReason = removalReason;
            await member.save({ session });

            // Update Company.members denormalized array
            await Company.findByIdAndUpdate(
                member.companyId,
                {
                    $pull: { members: member.userId },
                    $inc: { recruiterCount: -1 },
                },
                { session },
            );

            // Clear RecruiterProfile.currentCompanyId
            await RecruiterProfile.findOneAndUpdate(
                { user: member.userId },
                { currentCompanyId: null },
                { session },
            );

            result = member;
        });

        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * Change member role (transaction)
 */
export const changeMemberRoleService = async (
    memberId: string,
    newRole: CompanyRole,
    changedBy: string,
) => {
    const memberObjectId = new Types.ObjectId(memberId);
    const changedByObjectId = new Types.ObjectId(changedBy);
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const member = await CompanyMember.findById(memberObjectId, null, {
                session,
            });

            if (!member) {
                throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Member not found');
            }

            // Prevent demoting last OWNER
            if (
                member.role === CompanyRole.OWNER &&
                newRole !== CompanyRole.OWNER
            ) {
                const ownerCount = await CompanyMember.countDocuments(
                    {
                        companyId: member.companyId,
                        role: CompanyRole.OWNER,
                        status: MembershipStatus.ACTIVE,
                    },
                    { session },
                );

                if (ownerCount === 1) {
                    throw new ApiError(
                        HTTP_STATUS.FORBIDDEN,
                        'Cannot demote the last owner. Transfer ownership first.',
                    );
                }
            }

            const oldRole = member.role;
            member.role = newRole;
            await member.save({ session });

            // TODO: Update index if promoting to OWNER (should only have 1)
            // Handle in a post-update check if needed

            result = member;
        });

        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * Get all active members of a company
 */
export const getCompanyMembersService = async (companyId: string) => {
    const members = await CompanyMember.find({
        companyId: new Types.ObjectId(companyId),
        status: MembershipStatus.ACTIVE,
    })
        .populate('userId', 'name email')
        .sort({ createdAt: 1 });

    return members;
};

/**
 * Delegate billing admin permissions
 */
export const delegateBillingAdminService = async (
    companyId: string,
    newBillingAdminId: string,
) => {
    const companyObjectId = new Types.ObjectId(companyId);
    const adminObjectId = new Types.ObjectId(newBillingAdminId);

    // Verify admin exists and is ACTIVE member
    const member = await CompanyMember.findOne({
        userId: adminObjectId,
        companyId: companyObjectId,
        status: MembershipStatus.ACTIVE,
    });

    if (!member) {
        throw new ApiError(
            HTTP_STATUS.NOT_FOUND,
            'Member not found or not active',
        );
    }

    // Can only be OWNER or ADMIN role
    if (
        member.role !== CompanyRole.OWNER &&
        member.role !== CompanyRole.ADMIN
    ) {
        throw new ApiError(
            HTTP_STATUS.FORBIDDEN,
            'Only owner or admin can be billing admin',
        );
    }

    await Company.findByIdAndUpdate(companyObjectId, {
        billingAdmin: adminObjectId,
    });

    return { message: 'Billing admin updated', billingAdmin: adminObjectId };
};
