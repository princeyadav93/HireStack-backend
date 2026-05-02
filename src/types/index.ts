/**
 * Central export file for all type definitions
 * Import from here instead of individual files
 *
 * Usage: import { IUser, ICompany, ICompanyMember } from '../types'
 */

// User Types
export type { IUser, IUserSafe, IUserWithProfile } from './user.types';
export { UserRole } from './user.types';

// Authentication Types
export type {
    RegisterInput,
    LoginInput,
    JwtPayload,
    JwtTokens,
    AuthResponse,
    TokenRefreshRequest,
    CookieOptions,
} from './auth.types';

// Company Types
export type {
    CompanySize,
    CompanyStatus,
    CompanyLogo,
    CompanyLocation,
    ICompany,
    ICompanyDocument,
    ICompanyResponse,
    CompanyCreateInput,
    CompanyUpdateInput,
    CompanyFilterInput,
} from './company.types';

// Recruiter Types
export type {
    RecruiterSocialLinks,
    RecruiterProfileImage,
    IRecruiterProfile,
    IRecruiterProfileDocument,
    IRecruiterProfileResponse,
    RecruiterProfileCreateInput,
    RecruiterProfileUpdateInput,
    RecruiterStats,
} from './recruiter.types';

// Company Member Types
export type {
    CompanyMemberRole,
    ICompanyMember,
    ICompanyMemberDocument,
    ICompanyMemberResponse,
    ICompanyMemberSimple,
    MembershipCreateInput,
    MembershipFilterInput,
} from './companyMember.types';

// Candidate Types
export type {
    JobType,
    Resume,
    Project,
    Experience,
    Education,
    CandidatePreferences,
    ICandidateProfile,
    ICandidateProfileDocument,
    ICandidateProfileResponse,
    CandidateProfileCreateInput,
    CandidateProfileUpdateInput,
    CandidateProfileStats,
    CandidateSearchFilterInput,
} from './candidate.types';

// Common Types
export type {
    ApiResponse,
    PaginatedResponse,
    ErrorResponse,
    RequestUser,
    PaginationQuery,
    SortOptions,
    FilterBase,
    UploadedFile,
    FileUploadResponse,
    AuditTrail,
    SoftDeletable,
    Timestamps,
    SearchResult,
    Notification,
    BulkOperationResult,
} from './common.types';
export { HttpStatusCode } from './common.types';
