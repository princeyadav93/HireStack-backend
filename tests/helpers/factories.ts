import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { ENV } from '../../src/config/env';
import { User } from '../../src/models/user.model';
import { Company } from '../../src/models/company.model';
import { CompanyMember } from '../../src/models/companyMember.model';
import { CandidateProfile } from '../../src/models/candidateProfile.model';
import { Job } from '../../src/models/job.model';
import {
    CompanyRole,
    EmploymentType,
    JobStatus,
} from '../../src/constants/enums';

/**
 * Fixture builders.
 *
 * Records are written straight through the models rather than through the
 * registration endpoints: a test about applying to a job should fail when
 * applying breaks, not when registration does.
 */

export const TEST_PASSWORD = 'Password123!';

// Emails are unique-indexed and the database is wiped between tests, but a
// single test can build several users. A counter is enough to keep them apart.
let sequence = 0;
const uniqueEmail = (prefix: string) => `${prefix}-${++sequence}@example.com`;

export const createUser = async ({
    role = 'candidate',
    email,
    password = TEST_PASSWORD,
    name = 'Test User',
    // Verified by default, unlike a real registration. requireVerifiedEmail
    // gates applying and company creation, and a test about applying should
    // fail when applying breaks — not when the fixture never clicked a link.
    // Tests about verification itself opt out with `isEmailVerified: false`.
    isEmailVerified = true,
}: {
    role?: 'candidate' | 'recruiter' | 'admin';
    email?: string;
    password?: string;
    name?: string;
    isEmailVerified?: boolean;
} = {}) => {
    // The User schema has no pre-save hook — hashing lives in the registration
    // services, so a fixture has to do it itself or login can never match.
    const hashed = await bcrypt.hash(password, ENV.SALTROUNDS);

    return User.create({
        name,
        email: email ?? uniqueEmail(role),
        password: hashed,
        role,
        isEmailVerified,
    });
};

/**
 * A candidate who can actually apply — applyToJobService rejects anyone whose
 * profile has no résumé URL.
 */
export const createCandidate = async ({
    withResume = true,
    email,
    isEmailVerified = true,
}: {
    withResume?: boolean;
    email?: string;
    isEmailVerified?: boolean;
} = {}) => {
    const user = await createUser({
        role: 'candidate',
        email,
        isEmailVerified,
    });

    await CandidateProfile.create({
        user: user._id,
        ...(withResume && {
            resume: {
                url: 'https://res.cloudinary.com/test/raw/upload/resume.pdf',
                fileName: 'resume.pdf',
                uploadedAt: new Date(),
            },
        }),
    });

    return user;
};

export const createCompany = async ({
    createdBy,
    status = 'approved',
    name = 'Test Company',
}: {
    createdBy: Types.ObjectId;
    status?: 'pending' | 'approved' | 'rejected' | 'suspended';
    name?: string;
}) =>
    Company.create({
        name,
        industry: 'Software',
        createdBy,
        status,
        members: [createdBy],
    });

/**
 * A recruiter, the company they belong to, and the membership row that links
 * them — the tuple almost every company-scoped test needs.
 *
 * Company scope is read from this membership, never from the request, so the
 * row is what makes the recruiter's requests resolve to this company.
 */
export const createRecruiterWithCompany = async ({
    role = CompanyRole.OWNER,
    companyStatus = 'approved',
    companyName = 'Test Company',
    isEmailVerified = true,
}: {
    role?: CompanyRole;
    companyStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
    companyName?: string;
    isEmailVerified?: boolean;
} = {}) => {
    const recruiter = await createUser({ role: 'recruiter', isEmailVerified });

    const company = await createCompany({
        createdBy: recruiter._id,
        status: companyStatus,
        name: companyName,
    });

    const membership = await CompanyMember.create({
        userId: recruiter._id,
        companyId: company._id,
        role,
        status: true,
    });

    return { recruiter, company, membership };
};

export const createJob = async ({
    companyId,
    createdBy,
    status = JobStatus.PUBLISHED,
    title = 'Backend Engineer',
}: {
    companyId: Types.ObjectId;
    createdBy: Types.ObjectId;
    status?: JobStatus;
    title?: string;
}) =>
    Job.create({
        title,
        // The schema requires at least 20 characters.
        description: 'We are hiring a backend engineer to work on the API.',
        companyId,
        createdBy,
        employmentType: EmploymentType.FULL_TIME,
        status,
        ...(status === JobStatus.PUBLISHED && { publishedAt: new Date() }),
    });
