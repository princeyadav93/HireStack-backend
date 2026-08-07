# HireStack — Backend

A multi-tenant hiring platform API. Companies register, get approved by a platform
admin, post jobs, and move candidates through a hiring pipeline. Candidates build a
profile, browse published jobs, and apply.

Built with **TypeScript + Express 5 + MongoDB (Mongoose 9)**, with cookie-based JWT
auth, Zod validation, and strict per-company data isolation.

> **Status:** actively built, not yet production-deployed. See
> [ROADMAP.md](./ROADMAP.md) for what's done, what's next, and what's missing.

---

## Table of contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [How the platform works](#how-the-platform-works)
- [Roles and access control](#roles-and-access-control)
- [API reference](#api-reference)
- [Security](#security)
- [Project structure](#project-structure)
- [Branching and CI](#branching-and-ci)
- [Deployment notes](#deployment-notes)

---

## Quick start

**Requirements:** Node.js 20+, a MongoDB instance (local or Atlas), and a free
[Cloudinary](https://cloudinary.com) account for file uploads.

```bash
git clone https://github.com/princeyadav93/HireStack-backend.git
cd HireStack-backend
npm install

cp .env.example .env      # then fill in the values (see below)

npm run seed:admin        # creates the first platform admin
npm run dev               # http://localhost:3000
```

`GET /` returns `{ "status": "OK" }` when the server is up.

### Scripts

| Command              | Does                                                     |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Dev server with hot reload (`ts-node-dev`)               |
| `npm run build`      | Compile TypeScript to `dist/`                            |
| `npm start`          | Run the compiled build                                   |
| `npm run seed:admin` | Create the first platform admin (see below)              |

### Seeding the first admin

`POST /admin/register` requires an existing admin, so the very first one is created
out-of-band. Set `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`, or pass
them on the command line:

```bash
npm run seed:admin -- --name "Prince" --email admin@hirestack.dev --password "a-strong-password"
```

---

## Environment variables

**Required** — the server refuses to boot if any is missing:

| Variable                  | Notes                                              |
| ------------------------- | -------------------------------------------------- |
| `MONGODB_URI`             | Connection string                                  |
| `JWT_SECRET`              | Signs access tokens. Use 32+ random bytes.         |
| `SALTROUNDS`              | bcrypt cost. `10`–`12` is sensible.                |
| `CLOUDINARY_NAME`         | From the Cloudinary console                        |
| `CLOUDINARY_API_KEY`      | ″                                                  |
| `CLOUDINARY_API_SECRET`   | ″                                                  |

**Optional** — sensible defaults applied:

| Variable                 | Default                 | Notes                                                      |
| ------------------------ | ----------------------- | ---------------------------------------------------------- |
| `PORT`                   | `3000`                  |                                                            |
| `NODE_ENV`               | `development`           | `production` enables secure cookies and hides 5xx detail   |
| `CORS_ORIGIN`            | `http://localhost:3000` | **Comma-separated allowlist.** No wildcard — see below.    |
| `REFRESH_TOKEN_SECRET`   | falls back to `JWT_SECRET` | Set it to something different in production.            |
| `REFRESH_TOKEN_EXPIRY`   | `10d`                   |                                                            |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## How the platform works

### A company gets onboarded

1. A recruiter self-registers at `POST /recruiter/register` — a global `recruiter` user.
2. They call `POST /company/create`, which creates the company (`status: pending`) and
   makes them its **OWNER**.
3. A platform admin reviews it at `GET /admin/companies/pending` and approves or rejects it.
4. Only an **approved** company can publish jobs. Suspension flips the status back, and
   its jobs drop off the public board immediately — no rewriting of job records needed.

### A job goes live

`DRAFT` → `PUBLISHED` → `CLOSED`

- Jobs are always created as `DRAFT`. Drafting needs no approval; **publishing does**.
- `POST /jobs/:jobId/publish` re-checks the company's status at publish time.
- `CLOSED` is terminal: a closed job cannot be edited or republished.
- `DELETE /jobs/:jobId` is a **soft delete** (`isArchived: true`) so applications
  against it stay readable for audit.

### A candidate applies

1. Candidate registers, then uploads a résumé to their profile — **applying without one
   is rejected**.
2. `POST /jobs/:jobId/apply` checks the job is `PUBLISHED` *and* the company is still
   approved, then creates the application inside a transaction that also increments the
   job's `applicationCount`.
3. The résumé URL is **snapshotted onto the application**, so later profile edits cannot
   rewrite what a recruiter already reviewed.
4. A unique index on `(jobId, candidateId)` makes double-applying impossible, even under
   a race.

### The hiring pipeline

```
APPLIED ──► SHORTLISTED ──► INTERVIEW ──► HIRED
   │             │              │
   └─────────────┴──────────────┴────────► REJECTED
```

`HIRED` and `REJECTED` are **terminal** — a rejected candidate cannot be quietly revived,
and a hired one cannot be un-hired. Legal moves live in one table
(`ALLOWED_APPLICATION_TRANSITIONS`) rather than scattered `if` chains, and every change
is appended to `statusHistory` with who changed it and when.

---

## Roles and access control

Access is decided at three levels: **platform**, **company**, and **record**.

```
Platform
│
├─ Platform Admin ── approve / reject / suspend companies, audit users
│
└─ Users (JWT)
   ├─ Candidate ──── own profile + own applications only
   │
   └─ Company context (resolved from the CompanyMember record, never from the URL)
      ├─ OWNER ───── everything below + create/remove admins + edit company
      ├─ ADMIN ───── everything below + create/remove recruiters + delete jobs
      └─ RECRUITER ─ create, edit, publish, close jobs; review applications
```

**Company scope is never taken from the request.** `verifyCompanyMember` looks up the
caller's `CompanyMember` record and attaches `req.companyId` from it. A user cannot reach
another tenant's data by changing an ID in the URL — cross-tenant reads return **404, not
403**, so the API doesn't even confirm the record exists.

### Middleware chain

| Middleware                  | Checks                                                    |
| --------------------------- | --------------------------------------------------------- |
| `verifyJWT`                 | Valid, non-revoked **access** token → attaches `req.user`  |
| `verifyCandidate`           | `req.user.role === 'candidate'`                           |
| `verifyRecruiter`           | `req.user.role === 'recruiter'`                           |
| `verifyAdmin`               | Platform admin                                            |
| `verifyCompanyMember`       | Active membership → attaches `req.companyId`, `req.companyMember` |
| `verifyCompanyOwnerOrAdmin` | Membership role is OWNER or ADMIN                         |
| `verifyCompanyOwner`        | Membership role is OWNER                                  |

---

## API reference

All responses share one shape:

```jsonc
// success
{ "statusCode": 200, "data": { }, "message": "...", "success": true }

// failure
{ "success": false, "message": "...", "errors": ["field: reason"] }
```

Auth is **httpOnly cookies**, not `Authorization` headers — send credentialed requests
(`fetch(url, { credentials: 'include' })`).

### Auth — `/auth`

| Method | Path             | Access | Notes                                    |
| ------ | ---------------- | ------ | ---------------------------------------- |
| POST   | `/login`         | Public | Rate limited. Sets `token` cookie.       |
| POST   | `/logout`        | Auth   | Revokes **all** existing tokens          |
| POST   | `/refresh-token` | Public | Rotates the refresh token                |

### Candidate — `/candidate`

| Method | Path         | Access    |
| ------ | ------------ | --------- |
| POST   | `/register`  | Public    |
| GET    | `/`          | Auth      |

### Candidate profile — `/candidate/profile` *(candidate only)*

| Method | Path              | Notes                       |
| ------ | ----------------- | --------------------------- |
| GET    | `/`               |                             |
| PATCH  | `/basic`          |                             |
| PATCH  | `/projects`       |                             |
| PATCH  | `/experience`     |                             |
| PATCH  | `/education`      |                             |
| PATCH  | `/preferences`    |                             |
| PATCH  | `/resume`         | multipart, max 2 MB         |
| PATCH  | `/profile-image`  | multipart, max 2 MB         |

### Recruiter — `/recruiter`

| Method | Path        | Access |
| ------ | ----------- | ------ |
| POST   | `/register` | Public |

### Recruiter profile — `/recruiter/profile` *(recruiter only)*

| Method | Path              |
| ------ | ----------------- |
| GET    | `/`               |
| PATCH  | `/personal-info`  |
| PATCH  | `/social-links`   |
| PATCH  | `/avatar`         |

### Company — `/company`

| Method | Path                            | Access             |
| ------ | ------------------------------- | ------------------ |
| POST   | `/create`                       | Recruiter          |
| GET    | `/members`                      | Active member      |
| GET    | `/members/recruiter`            | Active member      |
| POST   | `/create-admin`                 | OWNER              |
| POST   | `/create-recruiter`             | OWNER / ADMIN      |
| DELETE | `/admins/:adminId`              | OWNER              |
| DELETE | `/recruiters/:recruiterId`      | OWNER / ADMIN      |
| PATCH  | `/block/member/:memberId`       | OWNER / ADMIN      |
| PATCH  | `/unblock/member/:memberId`     | OWNER / ADMIN      |
| GET    | `/:companyId`                   | Auth               |
| PATCH  | `/:companyId`                   | OWNER (own company only) |

### Platform admin — `/admin` *(platform admin only)*

| Method | Path                                  | Notes                        |
| ------ | ------------------------------------- | ---------------------------- |
| POST   | `/register`                           | Creates another admin        |
| GET    | `/companies/pending`                  |                              |
| GET    | `/companies`                          | Audit view                   |
| POST   | `/companies/approve/:companyId`       |                              |
| POST   | `/companies/:companyId/reject`        |                              |
| POST   | `/companies/:companyId/suspend`       |                              |
| POST   | `/companies/:companyId/unsuspend`     |                              |
| GET    | `/platform/companies`                 | Paginated                    |
| GET    | `/platform/users`                     | Paginated                    |
| DELETE | `/platform/companies/:companyId`      | Soft delete                  |

### Jobs — `/jobs`

| Method | Path                   | Access         | Notes                                 |
| ------ | ---------------------- | -------------- | ------------------------------------- |
| GET    | `/`                    | **Public**     | Published jobs, approved companies    |
| GET    | `/:jobId`              | **Public**     | Published detail                      |
| GET    | `/manage`              | Company member | Own board, drafts included            |
| GET    | `/manage/:jobId`       | Company member | Own detail, drafts included           |
| POST   | `/`                    | Company member | Created as `DRAFT`                    |
| PATCH  | `/:jobId`              | Company member | Rejected once `CLOSED`                |
| POST   | `/:jobId/publish`      | Company member | Requires an **approved** company      |
| POST   | `/:jobId/close`        | Company member |                                       |
| DELETE | `/:jobId`              | OWNER / ADMIN  | Soft delete                           |
| POST   | `/:jobId/apply`        | Candidate      | Requires a résumé on file             |
| GET    | `/:jobId/applications` | Company member | The pipeline for that job             |

**Public board filters:** `search`, `skills` (comma-separated), `employmentType`,
`workMode`, `city`, `minExperience`, `maxSalary`, `page`, `limit`.

### Applications — `/applications`

| Method | Path                        | Access                            |
| ------ | --------------------------- | --------------------------------- |
| GET    | `/me`                       | Candidate — own applications      |
| GET    | `/:applicationId`           | The applicant, or the owning company |
| PATCH  | `/:applicationId/status`    | Company member                    |

---

## Security

| Concern                | How it's handled                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Password storage       | bcrypt, configurable cost. `password` has `select: false` and is stripped again in `toJSON`.                  |
| Token transport        | httpOnly cookies — JavaScript on the page cannot read them. `secure` + `sameSite: strict` in production.      |
| Token confusion        | Access and refresh tokens carry a `type` claim; an endpoint expecting one rejects the other outright.         |
| Logout / revocation    | Logout increments `tokenVersion`, retiring **every** token issued before it. Checked on each request.         |
| Login enumeration      | Wrong email and wrong password return the identical 401, and a dummy bcrypt compare keeps timing flat.        |
| Brute force            | Login: 10 attempts / 15 min (successes don't count). Registration: 20 / hour. Global ceiling: 300 / 15 min.   |
| Cross-tenant access    | Company scope comes from the DB membership record, never the URL. Foreign records read as 404.                |
| Privilege escalation   | `POST /admin/register` requires an existing admin. The first is seeded from the CLI.                          |
| Injection via search   | User search terms are regex-escaped before reaching a `$regex` query.                                         |
| Unbounded queries      | `limit` is clamped to 100, `page` to ≥ 1.                                                                     |
| Payload size           | JSON and form bodies capped at 16 KB; uploads at 2 MB with type validation.                                   |
| Response headers       | `helmet()`                                                                                                    |
| CORS                   | Explicit origin allowlist with credentials. Unlisted origins are rejected with 403 — no wildcard is possible. |
| Error leakage          | 5xx messages are replaced with a generic string in production; stack traces never reach the client.           |

---

## Project structure

```
src/
├── config/        env validation, MongoDB, Cloudinary
├── constants/     enums (roles, job/application status, transition table)
├── constants.ts   HTTP status codes, cookie options, pagination limits
├── controllers/   HTTP layer — parse, delegate, respond
├── dtos/          Zod schemas; the only place request shapes are defined
├── middleware/    auth, role checks, rate limits, uploads, error handling
├── models/        Mongoose schemas and indexes
├── routes/        endpoint definitions
├── scripts/       seedAdmin
├── services/      business logic; everything that touches the DB
├── types/         shared TypeScript interfaces
└── utils/         ApiError, ApiResponse, asyncHandler, pagination, helpers
```

**The rule:** routes wire, controllers translate HTTP, services decide. Controllers never
query the database and services never touch `req` or `res`.

Two ordering constraints are load-bearing and commented in place:

- In `app.ts`, `companyMemberRouter` mounts **before** `companyOwnerRouter`, because the
  latter owns `GET /:companyId`, which would otherwise swallow `GET /company/members`.
- In `job.route.ts`, `/manage` and `/manage/:jobId` are registered **before** `/:jobId`.

---

## Branching and CI

| Branch       | Purpose                            | Protection                                                  |
| ------------ | ---------------------------------- | ----------------------------------------------------------- |
| `production` | Default. Deployable at all times.  | No deletion, no force-push, PR required, CI must pass        |
| `QA`         | Integration / pre-release testing  | No deletion, no force-push                                   |
| `dev`        | Day-to-day work                    | No deletion, no force-push                                   |

Flow: `dev` → PR into `QA` → PR into `production`. Repository admins can bypass on all
three, which keeps solo work unblocked without removing the guard rails.

**CI** (`.github/workflows/ci.yml`) runs on every push to those branches and on every PR
into `QA` or `production`:

1. `npm ci` — fails if `package.json` and the lockfile have drifted
2. `npx tsc --noEmit` — typecheck
3. `npm run build`
4. `npm test --if-present` — a no-op until a test suite exists

---

## Deployment notes

- **Set `NODE_ENV=production`.** It switches cookies to `secure` + `sameSite: strict` and
  stops 5xx responses leaking internal detail.
- **Behind a reverse proxy** (nginx, Heroku, Render, Railway), add
  `app.set('trust proxy', 1)` in `src/app.ts`, or rate limiting will see the proxy's IP
  for every request and throttle all users as one. Use `1`, not `true` — trusting every
  hop lets a client forge `X-Forwarded-For` and skip the limiter entirely.
- **Use a distinct `REFRESH_TOKEN_SECRET`.** It falls back to `JWT_SECRET`, which is fine
  for local work but means one leaked secret compromises both token types.
- **`CORS_ORIGIN` must list the real frontend origin(s).** Anything not listed gets a 403.
- **Rate limit counters are in-memory**, so they are per-process and reset on restart.
  Move to a shared store (Redis) before running more than one instance.

---

## Contributing

- Types stay strict — no `any` in new code without a comment saying why.
- Every request body goes through a Zod DTO in `src/dtos/`.
- Business logic lives in services, not controllers.
- Errors are thrown as `ApiError`; the global handler maps them to a response.
