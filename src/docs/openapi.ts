import { z } from 'zod';
import {
    RegisterDTO,
    LoginDTO,
    ForgotPasswordDTO,
    ResetPasswordDTO,
    VerifyEmailDTO,
} from '../dtos/user.dto';
import {
    CreateCompanyDTO,
    CreateAdminDTO,
    CreateRecruiterDTO,
    UpdateCompanyDTO,
} from '../dtos/company.dto';
import {
    CreateJobDTO,
    UpdateJobDTO,
    JobFilterDTO,
    CompanyJobFilterDTO,
} from '../dtos/job.dto';
import {
    ApplyToJobDTO,
    UpdateApplicationStatusDTO,
    ApplicationFilterDTO,
} from '../dtos/application.dto';
import {
    BasicProfileDTO,
    ProjectsDTO,
    ExperienceDTO,
    EducationDTO,
    PreferencesDTO,
} from '../dtos/candidateProfile.dto';
import { PersonalInfoDTO, SocialLinksDTO } from '../dtos/recruiterProfile.dto';

/**
 * The OpenAPI description of this API.
 *
 * Request schemas are generated from the same Zod DTOs the routes validate
 * with — never written out by hand. That is the entire point: the previous
 * hand-maintained collection drifted until it documented endpoints that no
 * longer existed, and anything hand-copied drifts the same way. Change a DTO
 * and this document changes with it, or the build fails.
 *
 * Paths are declared here because a route knows its URL and its middleware but
 * not its meaning. Adding an endpoint without adding it here is the one gap the
 * generation cannot close for you — `tests/integration/openapi.test.ts` fails
 * when the two fall out of step.
 */

/**
 * Zod emits JSON Schema 2020-12, which is exactly what OpenAPI 3.1 embeds — so
 * no conversion layer is needed. `$schema` is the one key to drop: it belongs
 * on a standalone document, not on a component inside one.
 *
 * `io: 'input'` matters. Several DTOs transform on parse — `skills` arrives as
 * "node,react" and comes out an array — and callers need the shape they must
 * *send*, not the shape the service receives.
 */
const schemaOf = (dto: z.ZodType): Record<string, unknown> => {
    const { $schema, ...rest } = z.toJSONSchema(dto, {
        io: 'input',
        // Some DTOs coerce or transform in ways JSON Schema cannot express.
        // Describing them loosely beats refusing to emit a document.
        unrepresentable: 'any',
    }) as Record<string, unknown>;

    return rest;
};

/**
 * What `.refine()` costs us.
 *
 * A refinement is arbitrary code, so it has no JSON Schema equivalent and is
 * silently dropped — the file-type check on an upload, `salary.max >= min`, and
 * "at least one field" on a PATCH all vanish. They are still enforced at
 * runtime; they just cannot be expressed here, so they are written into the
 * endpoint description instead. Anything a reader must know to build a valid
 * request has to survive somewhere.
 */
const REFINEMENT_NOTES = {
    updateJob: 'At least one field must be provided.',
    salary: 'If both are given, `salary.max` must be ≥ `salary.min`.',
} as const;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonBody = (name: string, required = true) => ({
    required,
    content: { 'application/json': { schema: ref(name) } },
});

const fileBody = (field: string, accept: string) => ({
    required: true,
    content: {
        'multipart/form-data': {
            schema: {
                type: 'object',
                properties: {
                    [field]: { type: 'string', format: 'binary' },
                },
                required: [field],
            },
        },
    },
    description: `${accept} Maximum 2 MB.`,
});

const pathParam = (name: string, description: string) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    description,
});

/** Query parameters generated from a filter DTO, so they cannot drift either. */
const queryFrom = (dto: z.ZodType) => {
    const schema = schemaOf(dto) as {
        properties?: Record<string, Record<string, unknown>>;
        required?: string[];
    };

    return Object.entries(schema.properties ?? {}).map(([name, prop]) => ({
        name,
        in: 'query',
        required: schema.required?.includes(name) ?? false,
        schema: prop,
    }));
};

const PAGINATION_PARAMS = [
    {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
    },
    {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        description: 'Clamped to 100 — an unbounded limit is a free full scan.',
    },
];

const ok = (description: string) => ({
    200: { description, content: { 'application/json': { schema: ref('ApiResponse') } } },
});

const created = (description: string) => ({
    201: { description, content: { 'application/json': { schema: ref('ApiResponse') } } },
});

export const openApiDocument = {
    openapi: '3.1.0',

    info: {
        title: 'HireStack API',
        version: '1.0.0',
        description: [
            'Multi-tenant hiring platform API.',
            '',
            '**Authentication is cookie-based.** Logging in sets httpOnly `token` and',
            '`refreshToken` cookies; there is no `Authorization` header. From a browser,',
            "send requests with `credentials: 'include'`. In this page, call `POST /auth/login`",
            'first and every later request is authenticated automatically.',
            '',
            '**Company scope is never read from the URL.** It is resolved from the',
            "caller's membership record, so records belonging to another company return",
            '404 rather than 403 — the API will not confirm they exist.',
        ].join('\n'),
    },

    servers: [{ url: 'http://localhost:3000', description: 'Local development' }],

    tags: [
        { name: 'Auth', description: 'Login, logout, tokens, account recovery' },
        { name: 'Candidate', description: 'Candidate registration and profile' },
        { name: 'Recruiter', description: 'Recruiter registration and profile' },
        { name: 'Company', description: 'Company creation and membership' },
        { name: 'Platform admin', description: 'Company approval and audits' },
        { name: 'Jobs', description: 'Job lifecycle and the public board' },
        { name: 'Applications', description: 'Applying and the hiring pipeline' },
    ],

    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'token',
                description:
                    'httpOnly access-token cookie, set by POST /auth/login.',
            },
        },

        schemas: {
            // Generated — these track the DTOs automatically.
            Register: schemaOf(RegisterDTO),
            Login: schemaOf(LoginDTO),
            ForgotPassword: schemaOf(ForgotPasswordDTO),
            ResetPassword: schemaOf(ResetPasswordDTO),
            VerifyEmail: schemaOf(VerifyEmailDTO),
            CreateCompany: schemaOf(CreateCompanyDTO),
            UpdateCompany: schemaOf(UpdateCompanyDTO),
            CreateCompanyAdmin: schemaOf(CreateAdminDTO),
            CreateCompanyRecruiter: schemaOf(CreateRecruiterDTO),
            CreateJob: schemaOf(CreateJobDTO),
            UpdateJob: {
                ...schemaOf(UpdateJobDTO),
                description: REFINEMENT_NOTES.updateJob,
            },
            ApplyToJob: schemaOf(ApplyToJobDTO),
            UpdateApplicationStatus: schemaOf(UpdateApplicationStatusDTO),
            BasicProfile: schemaOf(BasicProfileDTO),
            Projects: schemaOf(ProjectsDTO),
            Experience: schemaOf(ExperienceDTO),
            Education: schemaOf(EducationDTO),
            Preferences: schemaOf(PreferencesDTO),
            PersonalInfo: schemaOf(PersonalInfoDTO),
            SocialLinks: schemaOf(SocialLinksDTO),

            // Hand-written: response envelopes are built by ApiResponse and the
            // error middleware, not by a DTO, so there is nothing to generate.
            ApiResponse: {
                type: 'object',
                properties: {
                    statusCode: { type: 'integer', example: 200 },
                    data: { description: 'Endpoint-specific payload.' },
                    message: { type: 'string' },
                    success: { type: 'boolean', example: true },
                },
                required: ['statusCode', 'message', 'success'],
            },
            ApiError: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string' },
                    errors: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Field-level detail, e.g. "email: Invalid email".',
                    },
                },
                required: ['success', 'message'],
            },
        },

        responses: {
            BadRequest: {
                description: 'Validation failed.',
                content: { 'application/json': { schema: ref('ApiError') } },
            },
            Unauthorized: {
                description: 'Missing, expired or revoked token.',
                content: { 'application/json': { schema: ref('ApiError') } },
            },
            Forbidden: {
                description: 'Authenticated, but not permitted.',
                content: { 'application/json': { schema: ref('ApiError') } },
            },
            NotFound: {
                description:
                    'Not found — also returned for records belonging to another company.',
                content: { 'application/json': { schema: ref('ApiError') } },
            },
            TooManyRequests: {
                description: 'Rate limit exceeded.',
                content: { 'application/json': { schema: ref('ApiError') } },
            },
        },
    },

    // Everything requires the cookie unless a path opts out with `security: []`.
    security: [{ cookieAuth: [] }],

    paths: {
        // ── Health ──────────────────────────────────────────────
        '/': {
            get: {
                tags: ['Auth'],
                summary: 'Health check',
                security: [],
                responses: ok('Server is healthy.'),
            },
        },

        // ── Auth ────────────────────────────────────────────────
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Log in',
                description:
                    'Sets httpOnly `token` and `refreshToken` cookies. A wrong email and a wrong password return the identical 401 — the API does not reveal which accounts exist. Rate limited to 10 failures per 15 minutes; successes are not counted.',
                security: [],
                requestBody: jsonBody('Login'),
                responses: {
                    ...ok('Logged in; auth cookies set.'),
                    401: { $ref: '#/components/responses/Unauthorized' },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Log out everywhere',
                description:
                    'Increments `tokenVersion`, which revokes every token issued before now — not just this device.',
                responses: {
                    ...ok('Logged out; cookies cleared.'),
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/auth/refresh-token': {
            post: {
                tags: ['Auth'],
                summary: 'Rotate the refresh token',
                description:
                    'Reads the `refreshToken` cookie and issues a new pair. The old refresh token stops working immediately.',
                security: [],
                responses: {
                    ...ok('New token pair set.'),
                    401: { $ref: '#/components/responses/Unauthorized' },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },
        '/auth/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Request a password reset link',
                description:
                    'Always returns the same 200 whether or not the address exists, and mail failures are swallowed rather than surfaced — otherwise the response would reveal which addresses have accounts. Limited to 5 per hour.',
                security: [],
                requestBody: jsonBody('ForgotPassword'),
                responses: {
                    ...ok('If the account exists, a link has been sent.'),
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },
        '/auth/reset-password': {
            post: {
                tags: ['Auth'],
                summary: 'Reset a password with an emailed token',
                description:
                    'Single-use, expires in 1 hour. Also bumps `tokenVersion` and drops the stored refresh token, so every device is signed out — resetting is what you do when you fear compromise.',
                security: [],
                requestBody: jsonBody('ResetPassword'),
                responses: {
                    ...ok('Password changed; all sessions ended.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/auth/verify-email': {
            post: {
                tags: ['Auth'],
                summary: 'Verify an email address',
                description:
                    'Single-use, expires in 24 hours. A reset token cannot be redeemed here — the token type is part of the lookup.',
                security: [],
                requestBody: jsonBody('VerifyEmail'),
                responses: {
                    ...ok('Email verified.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/auth/verify-email/resend': {
            post: {
                tags: ['Auth'],
                summary: 'Resend the verification email',
                description:
                    'Requires a login rather than taking an address, because an endpoint that mails any address you name is both a spam relay and a way to test which addresses have accounts. Limited to 5 per hour.',
                responses: {
                    ...ok('Verification email sent.'),
                    401: { $ref: '#/components/responses/Unauthorized' },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },

        // ── Candidate ───────────────────────────────────────────
        '/candidate/register': {
            post: {
                tags: ['Candidate'],
                summary: 'Register a candidate',
                description:
                    'Limited to 20 per hour. Registration only claims an address — `isEmailVerified` flips solely on a link clicked in that inbox.',
                security: [],
                requestBody: jsonBody('Register'),
                responses: {
                    ...created('Candidate registered; auth cookie set.'),
                    409: {
                        description: 'Email already in use.',
                        content: { 'application/json': { schema: ref('ApiError') } },
                    },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },
        '/candidate': {
            get: {
                tags: ['Candidate'],
                summary: 'Get the signed-in candidate',
                responses: {
                    ...ok('Candidate returned.'),
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/candidate/profile': {
            get: {
                tags: ['Candidate'],
                summary: 'Get own candidate profile',
                responses: {
                    ...ok('Profile returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/candidate/profile/basic': {
            patch: {
                tags: ['Candidate'],
                summary: 'Update skills and social links',
                requestBody: jsonBody('BasicProfile'),
                responses: {
                    ...ok('Profile updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/candidate/profile/projects': {
            patch: {
                tags: ['Candidate'],
                summary: 'Replace projects',
                requestBody: jsonBody('Projects'),
                responses: {
                    ...ok('Projects updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/candidate/profile/experience': {
            patch: {
                tags: ['Candidate'],
                summary: 'Replace work experience',
                description: 'Dates are `YYYY-MM-DD` strings.',
                requestBody: jsonBody('Experience'),
                responses: {
                    ...ok('Experience updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/candidate/profile/education': {
            patch: {
                tags: ['Candidate'],
                summary: 'Replace education',
                requestBody: jsonBody('Education'),
                responses: {
                    ...ok('Education updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/candidate/profile/preferences': {
            patch: {
                tags: ['Candidate'],
                summary: 'Update job preferences',
                requestBody: jsonBody('Preferences'),
                responses: {
                    ...ok('Preferences updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/candidate/profile/resume': {
            patch: {
                tags: ['Candidate'],
                summary: 'Upload a résumé',
                description:
                    'Required before applying to any job. The URL is snapshotted onto each application at apply time, so replacing it later cannot rewrite what a recruiter already reviewed.',
                requestBody: fileBody('resume', 'PDF or Word document.'),
                responses: {
                    ...ok('Résumé uploaded.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    413: {
                        description: 'File exceeds 2 MB.',
                        content: { 'application/json': { schema: ref('ApiError') } },
                    },
                },
            },
        },
        '/candidate/profile/profile-image': {
            patch: {
                tags: ['Candidate'],
                summary: 'Upload a profile photo',
                requestBody: fileBody('profileImage', 'Image file.'),
                responses: {
                    ...ok('Photo uploaded.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },

        // ── Recruiter ───────────────────────────────────────────
        '/recruiter/register': {
            post: {
                tags: ['Recruiter'],
                summary: 'Register a recruiter',
                description:
                    'Creates a platform-level recruiter with no company yet. Limited to 20 per hour.',
                security: [],
                requestBody: jsonBody('Register'),
                responses: {
                    ...created('Recruiter registered; auth cookie set.'),
                    409: {
                        description: 'Email already in use.',
                        content: { 'application/json': { schema: ref('ApiError') } },
                    },
                    429: { $ref: '#/components/responses/TooManyRequests' },
                },
            },
        },
        '/recruiter/profile': {
            get: {
                tags: ['Recruiter'],
                summary: 'Get own recruiter profile',
                responses: {
                    ...ok('Profile returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/recruiter/profile/personal-info': {
            patch: {
                tags: ['Recruiter'],
                summary: 'Update personal info',
                requestBody: jsonBody('PersonalInfo'),
                responses: {
                    ...ok('Profile updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/recruiter/profile/social-links': {
            patch: {
                tags: ['Recruiter'],
                summary: 'Update social links',
                requestBody: jsonBody('SocialLinks'),
                responses: {
                    ...ok('Links updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/recruiter/profile/avatar': {
            patch: {
                tags: ['Recruiter'],
                summary: 'Upload an avatar',
                requestBody: fileBody('avatar', 'Image file.'),
                responses: {
                    ...ok('Avatar uploaded.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },

        // ── Company ─────────────────────────────────────────────
        '/company/create': {
            post: {
                tags: ['Company'],
                summary: 'Create a company',
                description:
                    'The calling recruiter becomes its OWNER. The company starts `pending` and cannot publish jobs until a platform admin approves it.',
                requestBody: jsonBody('CreateCompany'),
                responses: {
                    ...created('Company created, pending approval.'),
                    409: {
                        description: 'A company with this name already exists.',
                        content: { 'application/json': { schema: ref('ApiError') } },
                    },
                },
            },
        },
        '/company/members': {
            get: {
                tags: ['Company'],
                summary: 'List members of your company',
                responses: {
                    ...ok('Members returned.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/company/members/recruiter': {
            get: {
                tags: ['Company'],
                summary: 'List recruiters of your company',
                responses: {
                    ...ok('Recruiters returned.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/company/create-admin': {
            post: {
                tags: ['Company'],
                summary: 'Add a company admin (OWNER only)',
                requestBody: jsonBody('CreateCompanyAdmin'),
                responses: {
                    ...created('Admin created.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/company/create-recruiter': {
            post: {
                tags: ['Company'],
                summary: 'Add a company recruiter (OWNER or ADMIN)',
                requestBody: jsonBody('CreateCompanyRecruiter'),
                responses: {
                    ...created('Recruiter created.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/company/admins/{adminId}': {
            delete: {
                tags: ['Company'],
                summary: 'Remove a company admin (OWNER only)',
                parameters: [pathParam('adminId', 'User id of the admin.')],
                responses: {
                    ...ok('Admin removed.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/company/recruiters/{recruiterId}': {
            delete: {
                tags: ['Company'],
                summary: 'Remove a company recruiter (OWNER or ADMIN)',
                parameters: [pathParam('recruiterId', 'User id of the recruiter.')],
                responses: {
                    ...ok('Recruiter removed.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/company/block/member/{memberId}': {
            patch: {
                tags: ['Company'],
                summary: 'Block a member (OWNER or ADMIN)',
                parameters: [pathParam('memberId', 'Membership id.')],
                responses: {
                    ...ok('Member blocked.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/company/unblock/member/{memberId}': {
            patch: {
                tags: ['Company'],
                summary: 'Unblock a member (OWNER or ADMIN)',
                parameters: [pathParam('memberId', 'Membership id.')],
                responses: {
                    ...ok('Member unblocked.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/company/{companyId}': {
            get: {
                tags: ['Company'],
                summary: 'Get a company',
                parameters: [pathParam('companyId', 'Company id.')],
                responses: {
                    ...ok('Company returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
            patch: {
                tags: ['Company'],
                summary: 'Update your company (OWNER only)',
                description:
                    'Owning a company is not permission to edit any company: the id here must match the caller\'s own membership, or the request is refused.',
                parameters: [pathParam('companyId', 'Must be your own company.')],
                requestBody: jsonBody('UpdateCompany'),
                responses: {
                    ...ok('Company updated.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/company/{companyId}/logo': {
            patch: {
                tags: ['Company'],
                summary: 'Upload a company logo (OWNER only)',
                description:
                    'Replaces the previous file rather than orphaning it. The upload runs before the database write, so a storage failure leaves the existing logo in place.',
                parameters: [pathParam('companyId', 'Must be your own company.')],
                requestBody: fileBody('logo', 'PNG, JPEG or WebP.'),
                responses: {
                    ...ok('Logo updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },

        // ── Platform admin ──────────────────────────────────────
        '/admin/register': {
            post: {
                tags: ['Platform admin'],
                summary: 'Create another platform admin',
                description:
                    'Requires an existing admin. The first one is seeded from the CLI with `npm run seed:admin`, so the role cannot bootstrap itself over HTTP.',
                requestBody: jsonBody('Register'),
                responses: {
                    ...created('Admin created.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/admin/companies/pending': {
            get: {
                tags: ['Platform admin'],
                summary: 'List companies awaiting approval',
                responses: ok('Pending companies returned.'),
            },
        },
        '/admin/companies': {
            get: {
                tags: ['Platform admin'],
                summary: 'List all companies',
                responses: ok('Companies returned.'),
            },
        },
        '/admin/companies/approve/{companyId}': {
            post: {
                tags: ['Platform admin'],
                summary: 'Approve a company',
                description: 'Approval is what allows the company to publish jobs.',
                parameters: [pathParam('companyId', 'Company id.')],
                responses: {
                    ...ok('Company approved.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/admin/companies/{companyId}/reject': {
            post: {
                tags: ['Platform admin'],
                summary: 'Reject a company',
                parameters: [pathParam('companyId', 'Company id.')],
                responses: {
                    ...ok('Company rejected.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/admin/companies/{companyId}/suspend': {
            post: {
                tags: ['Platform admin'],
                summary: 'Suspend a company',
                description:
                    'Takes effect instantly across the platform: the public board joins to the company at query time, so all its jobs disappear without touching a single job record.',
                parameters: [pathParam('companyId', 'Company id.')],
                responses: {
                    ...ok('Company suspended.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/admin/companies/{companyId}/unsuspend': {
            post: {
                tags: ['Platform admin'],
                summary: 'Lift a suspension',
                parameters: [pathParam('companyId', 'Company id.')],
                responses: {
                    ...ok('Company reinstated.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/admin/platform/companies': {
            get: {
                tags: ['Platform admin'],
                summary: 'Audit companies (paginated)',
                parameters: PAGINATION_PARAMS,
                responses: ok('Companies returned.'),
            },
        },
        '/admin/platform/users': {
            get: {
                tags: ['Platform admin'],
                summary: 'Audit users (paginated)',
                parameters: PAGINATION_PARAMS,
                responses: ok('Users returned.'),
            },
        },
        '/admin/platform/companies/{companyId}': {
            delete: {
                tags: ['Platform admin'],
                summary: 'Soft-delete a company',
                description:
                    'Sets `isArchived`; nothing is physically removed, so applications stay readable for audit.',
                parameters: [pathParam('companyId', 'Company id.')],
                responses: {
                    ...ok('Company archived.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        // ── Jobs ────────────────────────────────────────────────
        '/jobs': {
            get: {
                tags: ['Jobs'],
                summary: 'Public job board',
                description:
                    'Published jobs from approved companies only. No authentication required.',
                security: [],
                parameters: [...queryFrom(JobFilterDTO), ...PAGINATION_PARAMS],
                responses: ok('Jobs returned.'),
            },
            post: {
                tags: ['Jobs'],
                summary: 'Create a job',
                description:
                    'Always created as `DRAFT`. Drafting needs no approval; publishing does.',
                requestBody: jsonBody('CreateJob'),
                responses: {
                    ...created('Draft job created.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/jobs/manage': {
            get: {
                tags: ['Jobs'],
                summary: "Your company's board, drafts included",
                parameters: [
                    ...queryFrom(CompanyJobFilterDTO),
                    ...PAGINATION_PARAMS,
                ],
                responses: {
                    ...ok('Jobs returned.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/jobs/manage/{jobId}': {
            get: {
                tags: ['Jobs'],
                summary: 'Get one of your jobs, draft or not',
                parameters: [pathParam('jobId', 'Job id.')],
                responses: {
                    ...ok('Job returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/jobs/{jobId}': {
            get: {
                tags: ['Jobs'],
                summary: 'Public job detail',
                description:
                    'Published jobs only. A draft or closed job is indistinguishable from one that does not exist.',
                security: [],
                parameters: [pathParam('jobId', 'Job id.')],
                responses: {
                    ...ok('Job returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
            patch: {
                tags: ['Jobs'],
                summary: 'Edit a job',
                description: `Rejected once the job is CLOSED. ${REFINEMENT_NOTES.updateJob} Status is deliberately not editable here — it moves through /publish and /close so the lifecycle rules cannot be bypassed.`,
                parameters: [pathParam('jobId', 'Job id.')],
                requestBody: jsonBody('UpdateJob'),
                responses: {
                    ...ok('Job updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
            delete: {
                tags: ['Jobs'],
                summary: 'Soft-delete a job (OWNER or ADMIN)',
                description:
                    'Sets `isArchived` so applications against it stay readable for audit.',
                parameters: [pathParam('jobId', 'Job id.')],
                responses: {
                    ...ok('Job archived.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/jobs/{jobId}/publish': {
            post: {
                tags: ['Jobs'],
                summary: 'Publish a job',
                description:
                    "Re-checks the company's approval status at publish time, not at draft time.",
                parameters: [pathParam('jobId', 'Job id.')],
                responses: {
                    ...ok('Job published.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/jobs/{jobId}/close': {
            post: {
                tags: ['Jobs'],
                summary: 'Close a job',
                description:
                    'Terminal — a closed job cannot be edited or republished.',
                parameters: [pathParam('jobId', 'Job id.')],
                responses: {
                    ...ok('Job closed.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/jobs/{jobId}/apply': {
            post: {
                tags: ['Applications'],
                summary: 'Apply to a job (candidate)',
                description:
                    'Requires a résumé on the profile. The application and the job\'s counter are written in one transaction, and a unique `(jobId, candidateId)` index makes double-applying impossible even under a race.',
                parameters: [pathParam('jobId', 'Job id.')],
                requestBody: jsonBody('ApplyToJob', false),
                responses: {
                    ...created('Application submitted.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: {
                        description: 'Already applied to this job.',
                        content: { 'application/json': { schema: ref('ApiError') } },
                    },
                },
            },
        },
        '/jobs/{jobId}/applications': {
            get: {
                tags: ['Applications'],
                summary: 'Pipeline for one job',
                parameters: [
                    pathParam('jobId', 'Job id.'),
                    ...queryFrom(ApplicationFilterDTO),
                    ...PAGINATION_PARAMS,
                ],
                responses: {
                    ...ok('Applications returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },

        // ── Applications ────────────────────────────────────────
        '/applications/me': {
            get: {
                tags: ['Applications'],
                summary: "A candidate's own applications",
                parameters: [
                    ...queryFrom(ApplicationFilterDTO),
                    ...PAGINATION_PARAMS,
                ],
                responses: {
                    ...ok('Applications returned.'),
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/applications/{applicationId}': {
            get: {
                tags: ['Applications'],
                summary: 'Get one application',
                description:
                    'Readable by the applicant or by a member of the owning company. Anyone else gets 404.',
                parameters: [pathParam('applicationId', 'Application id.')],
                responses: {
                    ...ok('Application returned.'),
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/applications/{applicationId}/status': {
            patch: {
                tags: ['Applications'],
                summary: 'Move an application through the pipeline',
                description:
                    'Legal moves: APPLIED → SHORTLISTED → INTERVIEW → HIRED, and REJECTED from any of those. HIRED and REJECTED are terminal. Every change appends to `statusHistory` with actor and timestamp.',
                parameters: [pathParam('applicationId', 'Application id.')],
                requestBody: jsonBody('UpdateApplicationStatus'),
                responses: {
                    ...ok('Status updated.'),
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
    },
} as const;
