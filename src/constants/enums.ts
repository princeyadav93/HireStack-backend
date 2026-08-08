/**
 * Company and Membership related enums
 */

export enum CompanyRole {
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    RECRUITER = 'RECRUITER',
}

export const CompanyRoleValues = Object.values(CompanyRole);

/**
 * Job lifecycle.
 *
 * DRAFT is private to the company; PUBLISHED is the only state candidates can
 * see or apply to; CLOSED keeps the job (and its applications) readable but
 * stops new applications.
 */
export enum JobStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    CLOSED = 'CLOSED',
}

export enum EmploymentType {
    FULL_TIME = 'FULL_TIME',
    PART_TIME = 'PART_TIME',
    INTERNSHIP = 'INTERNSHIP',
    CONTRACT = 'CONTRACT',
}

export enum WorkMode {
    ONSITE = 'ONSITE',
    REMOTE = 'REMOTE',
    HYBRID = 'HYBRID',
}

/**
 * What a one-time account token is for.
 *
 * Every lookup is keyed on this alongside the hash, so a password-reset token
 * cannot be redeemed to verify an email or the other way round — the same
 * reasoning as the `type` claim on access and refresh tokens.
 */
export enum VerificationTokenType {
    EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
    PASSWORD_RESET = 'PASSWORD_RESET',
}

export enum ApplicationStatus {
    APPLIED = 'APPLIED',
    SHORTLISTED = 'SHORTLISTED',
    INTERVIEW = 'INTERVIEW',
    REJECTED = 'REJECTED',
    HIRED = 'HIRED',
}

/**
 * Which status a recruiter may move an application to, from its current one.
 *
 * Encoded as data rather than if-chains so the pipeline has exactly one
 * definition — REJECTED and HIRED are terminal, so a rejected candidate cannot
 * be silently revived and an accepted one cannot be un-hired.
 */
export const ALLOWED_APPLICATION_TRANSITIONS: Record<
    ApplicationStatus,
    ApplicationStatus[]
> = {
    [ApplicationStatus.APPLIED]: [
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.REJECTED,
    ],
    [ApplicationStatus.SHORTLISTED]: [
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.REJECTED,
    ],
    [ApplicationStatus.INTERVIEW]: [
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
    ],
    [ApplicationStatus.REJECTED]: [],
    [ApplicationStatus.HIRED]: [],
};
