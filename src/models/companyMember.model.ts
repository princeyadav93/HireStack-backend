import mongoose, { Schema } from 'mongoose';
import {
    CompanyRole,
    MembershipStatus,
    MembershipSource,
} from '../constants/enums';
import { ICompanyMember } from '../types/companyMember.types';

const companyMemberSchema = new Schema<ICompanyMember>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
        },
        role: {
            type: String,
            enum: Object.values(CompanyRole),
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(MembershipStatus),
            default: MembershipStatus.PENDING,
        },
        source: {
            type: String,
            enum: Object.values(MembershipSource),
            required: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        removedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        invitedAt: Date,
        approvedAt: Date,
        rejectedAt: Date,
        removedAt: Date,
        rejectionReason: String,
        removalReason: String,
    },
    {
        timestamps: true,
    },
);

// ✅ Prevent duplicate membership
companyMemberSchema.index({ userId: 1, companyId: 1 }, { unique: true });

// ✅ Only one OWNER per company
companyMemberSchema.index(
    { companyId: 1, role: 1 },
    {
        unique: true,
        partialFilterExpression: { role: CompanyRole.OWNER },
    },
);

// Query optimization
companyMemberSchema.index({ companyId: 1, status: 1 });
companyMemberSchema.index({ userId: 1, status: 1 });

export const CompanyMember = mongoose.model<ICompanyMember>(
    'CompanyMember',
    companyMemberSchema,
);
