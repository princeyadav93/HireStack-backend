import { Document, Types } from 'mongoose';

/**
 * Company Size Type
 */
export type CompanySize =
    | 'STARTUP'
    | 'SMALL'
    | 'MEDIUM'
    | 'LARGE'
    | 'ENTERPRISE';

/**
 * Company Status Type
 */
export type CompanyStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/**
 * Company Logo Type
 */
export interface CompanyLogo {
    url?: string;
    fileName?: string;
    uploadedAt?: Date;
}

/**
 * Company Location Type
 */
export interface CompanyLocation {
    city: string;
    state?: string;
    country: string;
}

/**
 * ICompany - Main Company Document Interface
 */
export interface ICompany extends Document {
    _id: Types.ObjectId;
    name: string;
    industry: string;
    size: CompanySize;
    description?: string;
    website?: string;
    logo?: CompanyLogo;
    location?: CompanyLocation;
    recruiterCount: number;
    createdBy: Types.ObjectId; // OWNER of company
    status: CompanyStatus;
    members: Types.ObjectId[]; // Denormalized cache: only ACTIVE members
    isArchived: boolean; // Soft delete
    archivedAt?: Date;
    archivedBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    suspensionDetails?: {
        isSuspended: boolean;
        reason?: string;
        suspendedAt?: Date;
        suspendedBy?: Types.ObjectId;
        internalDescription?: string;
        publicDescription?: string;
        appealable?: boolean;
        appealDeadline?: Date;
    };
}

/**
 * Company Document Type
 */
export type ICompanyDocument = ICompany & Document;

/**
 * Company Response Type (for API responses)
 */
export interface ICompanyResponse {
    _id: string;
    name: string;
    industry: string;
    size: CompanySize;
    description?: string;
    website?: string;
    logo?: CompanyLogo;
    location?: CompanyLocation;
    recruiterCount: number;
    owner: string;
    members: Array<{
        userId: string;
        role: string;
    }>;
    status: CompanyStatus;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Company Create Input
 */
export interface CompanyCreateInput {
    name: string;
    industry: string;
    size: CompanySize;
    description?: string;
    website?: string;
    location?: CompanyLocation;
}

/**
 * Company Update Input
 */
export interface CompanyUpdateInput {
    name?: string;
    industry?: string;
    size?: CompanySize;
    description?: string;
    website?: string;
    location?: CompanyLocation;
    logo?: CompanyLogo;
}

/**
 * Company Filter Input
 */
export interface CompanyFilterInput {
    industry?: string;
    size?: CompanySize;
    status?: CompanyStatus;
    search?: string;
    page?: number;
    limit?: number;
}
