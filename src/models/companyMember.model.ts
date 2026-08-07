import mongoose, { Schema } from 'mongoose';
import { CompanyRole } from '../constants/enums';
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
            type: Boolean,
            default: true,
        },
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
