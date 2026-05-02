// src/types/companyMember.types.ts
import { Document, Types } from 'mongoose';

export type CompanyMemberRole = 'OWNER' | 'ADMIN' | 'RECRUITER';

export interface ICompanyMember extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    companyId: Types.ObjectId;
    role: CompanyMemberRole;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type ICompanyMemberDocument = ICompanyMember & Document;

export interface ICompanyMemberResponse {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
    };
    companyId: string;
    role: CompanyMemberRole;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ICompanyMemberSimple {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
    };
    role: CompanyMemberRole;
    status: boolean;
}

export interface MembershipCreateInput {
    userId: string;
    companyId: string;
    role: CompanyMemberRole;
}

export interface MembershipFilterInput {
    companyId?: string;
    userId?: string;
    role?: CompanyMemberRole;
    status?: boolean;
    page?: number;
    limit?: number;
}
