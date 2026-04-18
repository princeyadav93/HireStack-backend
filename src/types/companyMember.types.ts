import { Document, Types } from 'mongoose';

/**
 * Company Member Role Type
 */
export type CompanyMemberRole = 'OWNER' | 'ADMIN' | 'RECRUITER';

/**
 * Membership Status Type
 */
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED';

/**
 * Membership Source Type (how they joined)
 */
export type MembershipSource = 'CREATED' | 'INVITE' | 'REQUEST';

/**
 * ICompanyMember - Company Member Document Interface
 * Tracks membership status with full audit trail
 */
export interface ICompanyMember extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId; // Reference to User
    companyId: Types.ObjectId; // Reference to Company
    role: CompanyMemberRole; // OWNER, ADMIN, RECRUITER
    status: MembershipStatus; // PENDING, ACTIVE, REJECTED, REMOVED
    source: MembershipSource; // How they joined (CREATED, INVITE, REQUEST)

    // Invite tracking (for source=INVITE)
    invitedBy?: Types.ObjectId;
    invitedAt?: Date;

    // Approval tracking
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;

    // Rejection tracking
    rejectedBy?: Types.ObjectId;
    rejectionReason?: string;
    rejectedAt?: Date;

    // Removal tracking
    removedBy?: Types.ObjectId;
    removalReason?: string;
    removedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Company Member Document Type
 */
export type ICompanyMemberDocument = ICompanyMember & Document;

/**
 * Company Member Response Type (populated with user data)
 */
export interface ICompanyMemberResponse {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
    };
    companyId: string;
    role: CompanyMemberRole;
    status: MembershipStatus;
    source: MembershipSource;
    invitedBy?: string;
    invitedAt?: Date;
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectionReason?: string;
    rejectedAt?: Date;
    removedBy?: string;
    removalReason?: string;
    removedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Company Member Simple Response (for member lists)
 */
export interface ICompanyMemberSimple {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
    };
    role: CompanyMemberRole;
    status: MembershipStatus;
    approvedAt?: Date;
}

/**
 * Membership Create Input
 */
export interface MembershipCreateInput {
    userId: string;
    companyId: string;
    role: CompanyMemberRole;
    source: MembershipSource;
    invitedBy?: string;
}

/**
 * Membership Update Input
 */
export interface MembershipUpdateInput {
    role?: CompanyMemberRole;
    status?: MembershipStatus;
}

/**
 * Membership Filter Input
 */
export interface MembershipFilterInput {
    companyId?: string;
    userId?: string;
    role?: CompanyMemberRole;
    status?: MembershipStatus;
    page?: number;
    limit?: number;
}

/**
 * Membership Audit Entry (for tracking changes)
 */
export interface MembershipAuditEntry {
    action: 'INVITED' | 'APPROVED' | 'REJECTED' | 'REMOVED' | 'ROLE_CHANGED';
    performedBy: string;
    timestamp: Date;
    reason?: string;
    previousRole?: CompanyMemberRole;
    newRole?: CompanyMemberRole;
}
