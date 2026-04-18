/**
 * Company and Membership related enums
 */

export enum CompanyRole {
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    RECRUITER = 'RECRUITER',
}

export enum MembershipStatus {
    PENDING = 'PENDING',
    ACTIVE = 'ACTIVE',
    REJECTED = 'REJECTED',
    REMOVED = 'REMOVED',
}

export enum MembershipSource {
    CREATED = 'CREATED', // Owner created company
    INVITE = 'INVITE', // Owner/Admin invited
    REQUEST = 'REQUEST', // Recruiter requested to join
}

export const CompanyRoleValues = Object.values(CompanyRole);
export const MembershipStatusValues = Object.values(MembershipStatus);
export const MembershipSourceValues = Object.values(MembershipSource);
