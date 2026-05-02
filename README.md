# 🚀 HireStack Backend - Multi-Tenant Hiring Platform

A **production-ready**, **type-safe** Node.js backend for a modern hiring platform with robust **role-based access control**, **multi-tenant architecture**, and **enterprise-grade security practices**.

---

## 🏗️ Architecture Overview

HireStack operates on a **multi-tenant model** with **hierarchical, role-based access control** across three distinct layers:

### Access Control Layers

#### 🌍 Global Level (Platform Admin)

- **Platform Admin**: HireStack employees managing platform integrity
    - Approve/reject company registrations
    - Remove fraudulent companies & fake job postings
    - Manage platform-wide policies
    - Monitor system health & analytics

#### 🏢 Company Level (Hierarchical Roles)

- **Owner**: Company ownership & billing
    - ✅ Full access to all company operations
    - Manage billing, subscriptions, and company settings
    - Add/remove team members
    - All Recruiter + Admin permissions inherited

- **Admin**: Company administrator
    - ✅ Full Recruiter permissions (job posting, deletion, management)
    - Company settings & profile management
    - Team member management & role assignments
    - Cannot access billing

- **Recruiter**: Job posting specialist
    - ✅ Limited access: Create job postings
    - Delete own job postings
    - View job applications & candidate profiles
    - Manage candidate interactions

#### 👤 User Level (Global Roles)

- **Candidate**: Job seeker
    - Apply to jobs
    - Manage personal profile & resume
    - Track applications
- **Recruiter/Admin/Owner**: See Company Level roles above

#### Resource Level

- Record-level permissions - users access only authorized data (company-isolated, user-owned records)

```
Platform Layer (Global)
│
├─ Global Admin (HireStack employees)
│   └─ Manage companies, block frauds, monitor system
│
└─ Users (JWT Auth)
    ├─ Candidate
    │   └─ Personal profile & applications only
    │
    └─ Company Context → Multi-tenant data isolation
        ├─ Owner
        │   └─ Full Access: Billing, Team, Jobs, Settings
        │       └─ Inherits: Admin + Recruiter permissions
        │
        ├─ Admin
        │   └─ Full Access: Team, Jobs, Company Settings
        │       └─ Inherits: Recruiter permissions
        │
        └─ Recruiter
            └─ Limited Access: Create/Delete jobs, Review applications
```

---

## 🛠️ Tech Stack & Best Practices

### Core Technologies

- **Runtime**: Node.js with **TypeScript** (strict mode enabled)
- **Framework**: Express.js v5 with middleware pipeline
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) with secure HTTP-only cookies
- **Validation**: Zod schema validation
- **Security**: Helmet, CORS with dynamic production settings, bcrypt password hashing
- **File Uploads**: Cloudinary integration with multer (2MB limit, type validation)
- **Logging**: Morgan request logging

### Code Quality Standards Implemented

✅ **Async/Await Wrapper** - Custom `asyncHandler` utility eliminates repeated try-catch boilerplate  
✅ **Standardized API Responses** - Consistent JSON format: `{ success, data, message }`  
✅ **Type Safety** - Full TypeScript compilation with `strict: true`, no unused variables  
✅ **Input Validation** - DTO (Data Transfer Object) schemas with Zod validation  
✅ **Error Handling** - Centralized error middleware with descriptive HTTP status codes  
✅ **Environment Safety** - Required ENV validation on startup (fails fast if configs missing)  
✅ **Database Transactions** - Multi-step operations wrapped in Mongoose transactions  
✅ **Security Headers** - Helmet middleware for XSS, CSRF, clickjacking protection

---

## 📋 What's Implemented

### Authentication & Authorization

- JWT-based stateless authentication with secure HTTP-only cookies
- **Granular Role-Based Access Control (RBAC)**:
    - **Global Admin**: Platform employees with company moderation capabilities
    - **Company Owner**: Full billing & team control, inherits all permissions
    - **Company Admin**: Team & job management, inherits Recruiter permissions
    - **Company Recruiter**: Job posting & candidate interaction (limited scope)
    - **Candidate**: Job applications & profile management
- Middleware-based role verification (`verifyJWT`, `verifyRecruiter`, etc.)
- Secure password hashing with bcrypt
- Production-grade HTTPS enforcement with secure cookies

### Multi-Tenant Features

- **Company Management**: Create, update, and manage company profiles (status: pending/approved/rejected)
- **Team Management**: Add recruiters with hierarchical role assignments (Recruiter → Admin → Owner)
- **Company-Scoped Data**: All resources (job postings, applications, candidates) are company-isolated
- **Admin Moderation**: Global admins can approve, reject, or remove fraudulent companies

### User Management

- User registration & login with validation
- Candidate profiles with resume uploads to Cloudinary
- Recruiter profiles with company associations
- Profile update with file validation

### Data Integrity

- Mongoose schema validation with `runValidators: true`
- File type & size constraints enforced at API level
- Request body size limits (16KB default)

---

## 🔄 How It Works

### Typical Flow: Candidate Applies to Job

1. **Candidate logs in** → JWT token issued, stored in HTTP-only cookie
2. **Browse jobs** → Route uses `verifyJWT` middleware to authenticate
3. **Submit application** → Application created with candidate ID & company context
4. **Company-level isolation** → Only company recruiters can see applications for their company

### Typical Flow: Recruiter Creates & Manages Jobs

1. **Recruiter logs in** → JWT token with company context attached
2. **Create job posting** → Middleware verifies `verifyRecruiter` role
3. **Post publicly** → Job visible to all candidates
4. **Review applications** → See only candidates who applied to their company's jobs
5. **Delete job** → Can delete only own postings

### Typical Flow: Company Owner Manages Team & Billing

1. **Owner logs in** → JWT token with owner privileges
2. **Access company settings** → Full company profile, member list, billing portal
3. **Add new Admin/Recruiter** → Assign roles with granular permissions
4. **Manage subscriptions** → Billing, payment methods (Owner-only access)
5. **All Recruiter/Admin actions available** → Owner inherits full permissions

### Typical Flow: Global Admin Moderates Platform

1. **Platform Admin logs in** → Global admin privileges
2. **Review pending companies** → List companies awaiting approval
3. **Verify company legitimacy** → Approve enterprise domains auto-verify, manually verify Gmail/Yahoo users
4. **Remove frauds** → Delete fake companies, block spam job postings
5. **Monitor metrics** → View platform-wide analytics & health

---

## � Module Status

### Routes & Handlers (Implemented)

| Module                | Route File                  | Controller                       | Service                       | Status      |
| --------------------- | --------------------------- | -------------------------------- | ----------------------------- | ----------- |
| **Authentication**    | `auth.route.ts`             | `auth.controller.ts`             | `auth.service.ts`             | ✅ Complete |
| **Platform Admin**    | `platformAdmin.route.ts`    | `platformAdmin.controller.ts`    | `platformAdmin.service.ts`    | ✅ Complete |
| **Company Owner**     | `companyOwner.route.ts`     | `companyOwner.controller.ts`     | `companyOwner.service.ts`     | ✅ Complete |
| **Company Member**    | `companyMember.route.ts`    | `companyMembers.controller.ts`   | `companyMember.service.ts`    | ✅ Complete |
| **Recruiter**         | `recruiter.route.ts`        | `recruiter.controller.ts`        | `recruiter.service.ts`        | ✅ Complete |
| **Recruiter Profile** | `recruiterProfile.route.ts` | `recruiterProfile.controller.ts` | `recruiterProfile.service.ts` | ✅ Complete |
| **Candidate**         | `candidate.route.ts`        | `candidate.controller.ts`        | `candidate.service.ts`        | ✅ Complete |
| **Candidate Profile** | `candidateProfile.route.ts` | `candidateProfile.controller.ts` | `candidateProfile.service.ts` | ✅ Complete |
| **Admin**             | `admin.route.ts`            | `admin.controller.ts`            | `admin.service.ts`            | ✅ Complete |

---

## 🏛️ Architecture Decisions

| Decision                  | Before                                        | Now                                            | Rationale                                           |
| ------------------------- | --------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| **Member Creation**       | Invite/join flow                              | Top-down only                                  | Simplifies auth, prevents unauthorized access       |
| **Recruiter Bootstrap**   | Multiple paths                                | Global self-register → creates company → OWNER | Single, clear onboarding path                       |
| **Member Addition**       | Any role could invite                         | OWNER or ADMIN only                            | Enforces hierarchy, improves security               |
| **Membership Model**      | `MembershipStatus` (enum), `MembershipSource` | Boolean `active` status                        | Cleaner data model, faster queries                  |
| **Blocked Members**       | Separate status                               | `active: false`                                | Reduces DB schema complexity                        |
| **Billing Admin**         | Separate role                                 | Removed (OWNER handles billing)                | Simplifies role model, OWNER inherits all           |
| **Ownership Transfer**    | Allowed                                       | Not allowed                                    | Prevents unauthorized transfers, audit clarity      |
| **Company ID Resolution** | From URL params                               | From CompanyMember record                      | Prevents parameter tampering, source of truth in DB |

---

## 🔗 Cross-Module Dependencies

### Authentication Module

- **Entry point**: `/auth/register` (global recruiter only), `/auth/login`
- **Outputs**: JWT token, company context
- **Depends on**: User model, JWT config

### Platform Admin Module (`platformAdmin.*`)

- **Routes**: Approve/reject companies, remove fraudulent records
- **Depends on**: Company model, global admin role verification
- **Used by**: Platform admins only

### Company Owner Module (`companyOwner.*`)

- **Routes**: Create company (during recruiter self-register), manage company settings, manage billing
- **Depends on**: Company model, CompanyMember model, User authentication
- **Used by**: Company owners

### Company Member Module (`companyMember.*`)

- **Routes**: Create ADMIN/RECRUITER members (OWNER/ADMIN only), list members, update roles
- **Depends on**: CompanyMember model (resolves companyId from record, not URL)
- **Used by**: OWNER, ADMIN roles

### Recruiter Module (`recruiter.*`)

- **Routes**: Create/update/delete job postings
- **Depends on**: Company context from CompanyMember, Job model
- **Used by**: RECRUITER, ADMIN, OWNER roles

### Candidate Module (`candidate.*`)

- **Routes**: Apply to jobs, list applications
- **Depends on**: User model, Application model
- **Used by**: CANDIDATE role

### Profile Modules (`recruiterProfile.*`, `candidateProfile.*`)

- **Routes**: Update personal profiles, upload resumes/photos
- **Depends on**: User model, Cloudinary integration
- **Used by**: Respective user types

---

## ✋ Not Yet Started

- **Job Analytics**: View counts, application metrics per recruiter/company
- **Candidate Search**: Full-text search on skills, experience, location
- **Bulk Operations**: Import candidates, batch job posting
- **API Integrations**: ATS connectors, third-party service APIs

---

## �🚀 What's Next

### Phase 1: Company Verification & Role Expansion (Smart Email Domain Validation)

- **Owner Role Implementation**: Full company & billing management access
- **Admin Role Implementation**: Team & job management with Recruiter permission inheritance
- **Enterprise Domain Auto-Verify**: Automatic approval for official company emails (recruiter@companyname.com)
- **Alternative Verification**: Manual approval workflow for small businesses using free email domains (Gmail, Yahoo, Outlook)
- **Fraud Detection**: Global admin dashboard to review and reject suspicious company registrations
- **Company Status Tracking**: Full lifecycle (pending → approved/rejected → active/blocked)

### Phase 2: Job Posting & Matching

- Full-text search for candidates (skills, location, experience, role)
- Job posting creation with company context & visibility controls
- Intelligent candidate-job matching algorithm
- Job analytics (views, applications, conversion rates)

### Phase 3: Analytics & Insights

- Recruitment pipeline analytics per company
- Time-to-hire metrics & candidate flow tracking
- Team performance insights (recruiter stats)
- Platform-wide metrics (total companies, active jobs, placements)

### Phase 4: Premium Features

- Billing & subscription management (Owner role)
- Advanced search filters & saved searches
- Bulk operations (import candidates, batch job posting)
- API integrations with ATS (Applicant Tracking Systems)

---

## 📦 Project Structure

```
src/
├── config/          # Environment & service configs (MongoDB, Cloudinary, JWT)
├── controllers/     # Request handlers for each resource
├── middleware/      # Auth, error handling, role verification, file uploads
├── models/          # Mongoose schemas (User, Company, Recruiter, Profile)
├── routes/          # API endpoint definitions
├── services/        # Business logic (register, login, profile management)
├── dtos/            # Zod schemas for input validation
├── types/           # TypeScript type definitions
├── utils/           # Helpers (asyncHandler, ApiError, validators)
└── constants.ts     # Global constants (HTTP status, cookie options)
```

---

## 🤝 Contributing

This project follows strict TypeScript & code quality standards. Ensure new features include:

- Type-safe implementations
- Input validation via Zod DTOs
- Proper error handling with descriptive messages
- Unit tests for business logic
