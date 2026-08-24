# HireStack — Backend

A multi-tenant hiring platform API. Companies register, get approved by a platform
admin, post jobs, and move candidates through a hiring pipeline. Candidates build a
profile, browse published jobs, and apply.

Built with **TypeScript + Express 5 + MongoDB (Mongoose 9)**, with cookie-based JWT
auth, Zod validation, and strict per-company data isolation.

> **Status:** actively built, not yet production-deployed.

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
| `APP_URL`                | `http://localhost:5173` | **Frontend** base URL — where email links point            |
| `EMAIL_FROM`             | `HireStack <no-reply@hirestack.local>` |                                             |
| `SMTP_HOST`              | *(unset)*               | Blank ⇒ emails print to the console instead of sending     |
| `SMTP_PORT`              | `587`                   |                                                            |
| `SMTP_USER` / `SMTP_PASS`| *(unset)*               | Omit both for relays that take no credentials              |
| `SMTP_SECURE`            | `false`                 | `true` only for implicit TLS on port 465                   |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Email

Verification and password-reset links are sent over **SMTP**, not a provider SDK, so
picking a provider is configuration rather than a code change — Resend, SendGrid,
Mailgun, SES, Mailtrap and Gmail all expose SMTP credentials. `.env.example` lists the
hosts.

Leave `SMTP_HOST` blank and nothing is sent: the message is printed to the server
console, link included. That is enough to complete a full password reset locally
without signing up for anything.

`APP_URL` is the **frontend**, not this API. A link lands on
`{APP_URL}/reset-password?token=…`, and the page there posts the token back to
`POST /auth/reset-password`.

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

**Interactive docs run with the app: [http://localhost:3000/docs](http://localhost:3000/docs).**
The raw OpenAPI 3.1 document is at `/docs.json`, ready for client generators.

Request schemas there are generated from the same Zod DTOs the routes validate with, so
they cannot drift from the code. A test fails CI if a route is added without a matching
entry in `src/docs/openapi.ts`.

The tables below stay as a quick reference.

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

| Method | Path                    | Access | Notes                                                          |
| ------ | ----------------------- | ------ | -------------------------------------------------------------- |
| POST   | `/login`                | Public | Rate limited. Sets `token` cookie.                             |
| POST   | `/logout`               | Auth   | Revokes **all** existing tokens                                |
| GET    | `/me`                   | Auth   | User + company membership + profile completion, in one call    |
| POST   | `/change-password`      | Auth   | `{ currentPassword, newPassword }`. Keeps this session, ends the rest |
| POST   | `/refresh-token`        | Public | Rotates the refresh token                                      |
| POST   | `/forgot-password`      | Public | Always 200, same message — never says whether the email exists |
| POST   | `/reset-password`       | Public | `{ token, password }`. Signs every session out.                |
| POST   | `/verify-email`         | Public | `{ token }`                                                    |
| POST   | `/verify-email/resend`  | Auth   | Auth'd on purpose — see below                                  |

Tokens are 32 random bytes, stored only as a SHA-256 hash, single-use, and scoped to
one purpose: a reset token cannot verify an email or the reverse. Reset links last 1
hour, verification links 24 hours, and requesting a new one retires the previous.

`/verify-email/resend` requires a login rather than taking an email address, because an
endpoint that mails any address you name is both a spam relay and a way to test which
addresses have accounts.

`GET /me` is the one call a client needs before it can render a signed-in view: the user,
the company they belong to and their role in it, and — for a candidate — how complete
their profile is. `membership` is `null` for candidates and platform admins. It is read
from the same record that authorises the company routes, so it cannot report access the
API would refuse.

`/change-password` is for someone who is signed in; `/forgot-password` is for someone who
is not. Both revoke every other session, but a change hands the caller a fresh cookie pair
rather than signing them out of the browser they are using — a reset does not, because
fear of compromise is the reason to reset.

### Candidate — `/candidate`

| Method | Path         | Access    |
| ------ | ------------ | --------- |
| POST   | `/register`  | Public    |

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
| POST   | `/create`                       | Recruiter — **verified email** |
| GET    | `/me`                           | Active member — your own company, no id needed |
| GET    | `/members`                      | Active member      |
| GET    | `/members/recruiter`            | Active member      |
| POST   | `/create-admin`                 | OWNER — **verified email** |
| POST   | `/create-recruiter`             | OWNER / ADMIN — **verified email** |
| DELETE | `/admins/:adminId`              | OWNER              |
| DELETE | `/recruiters/:recruiterId`      | OWNER / ADMIN      |
| PATCH  | `/block/member/:memberId`       | OWNER / ADMIN      |
| PATCH  | `/unblock/member/:memberId`     | OWNER / ADMIN      |
| GET    | `/:companyId`                   | Auth               |
| PATCH  | `/:companyId`                   | OWNER (own company only) |
| PATCH  | `/:companyId/logo`              | OWNER (own company only) — multipart field `logo`, PNG/JPEG/WebP, max 2 MB |

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
| POST   | `/:jobId/apply`        | Candidate      | Requires a résumé on file and a **verified email** |
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
| Token transport        | httpOnly cookies — JavaScript on the page cannot read them, and they are never echoed in a response body. `secure` in production, `sameSite: lax` throughout — see the deployment notes for why not `strict` or `none`. |
| Token confusion        | Access and refresh tokens carry a `type` claim; an endpoint expecting one rejects the other outright.         |
| Logout / revocation    | Logout increments `tokenVersion`, retiring **every** token issued before it. Checked on each request.         |
| Login enumeration      | Wrong email and wrong password return the identical 401, and a dummy bcrypt compare keeps timing flat.        |
| Reset enumeration      | `/forgot-password` returns one fixed 200 for every address, and mail failures are swallowed so they can't leak it either. |
| Reset link safety      | 32 random bytes, stored SHA-256 hashed, single-use via an atomic `findOneAndDelete`, expiring in 1 hour.      |
| Reset ⇒ full logout    | A reset bumps `tokenVersion` and drops the stored refresh token, so an attacker's live session dies with it.  |
| Change ⇒ others out    | A change from inside a session revokes every *other* session and reissues this one, so the safe habit does not sign you out of the browser you are in. |
| Email ownership        | Registration only claims an address; `isEmailVerified` flips solely on a link clicked in that inbox.          |
| Unverified accounts    | Creating a company, applying to a job and creating teammate accounts require a verified address; browsing, profile building and drafting stay open. Verifying lifts the gate on the next request — no re-login. |
| Brute force            | Login: 10 attempts / 15 min (successes don't count). Registration: 20 / hour. Mail-sending endpoints: 5 / hour. Global ceiling: 300 / 15 min. |
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
├── config/        env validation, MongoDB, Cloudinary, logger
├── docs/          OpenAPI document; schemas generated from the DTOs
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

### Serve the frontend and the API from one origin

**This is the single most important deployment decision here, and it has to be made
before the frontend is written.**

A browser only sends a cookie back to the site that set it. Auth is cookie-based, so if
the frontend is served from `hirestack.vercel.app` and this API from
`hirestack-api.onrender.com`, every credentialed call is cross-site and the cookie is
dropped: the user logs in successfully and the next request arrives anonymous. Nothing in
this repo can detect that — it looks identical to "not logged in".

The fix is to give them one origin, by having the frontend host proxy through to this
service. On Vercel that is a `vercel.json` in the frontend repo:

```jsonc
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://hirestack-api.onrender.com/:path*" }
  ]
}
```

The frontend then calls `/api/auth/login` instead of the Render URL, the browser sees a
single origin, and `sameSite: 'lax'` works. Two consequences worth knowing:

- **CORS stops mattering for the app itself.** The browser never makes a cross-origin
  request, so `CORS_ORIGIN` only governs direct callers — local dev, Postman, anything
  hitting the API host straight.
- **Check `TRUST_PROXY` once it is live.** It defaults to `1` — one proxy hop, which is
  Render on its own. A rewrite puts a second hop in front, so `req.ip` may resolve to the
  frontend host's edge address rather than the real client, and every user would land in
  one rate-limit bucket. See below.

The alternative — `sameSite: 'none'` on the cookies — is one line and permits cross-site
requests from *any* site, not just yours. That is CSRF, and taking it means also building
token or origin checks on every state-changing route. The rewrite avoids the problem
rather than answering it. See the comment on `COOKIE_OPTIONS` in `src/constants.ts`.

### Getting `TRUST_PROXY` right

Rate limits are counted per client IP, and `TRUST_PROXY` is what decides which address in
`X-Forwarded-For` counts as the client. Set it to the number of proxies in front of the
app:

| Setup | Value |
| ----- | ----- |
| Local, no proxy | `0` |
| Render / Railway / Fly / nginx alone | `1` *(default)* |
| Vercel rewrite → Render | `2` |
| Cloudflare → Vercel rewrite → Render | `3` |

Too low and every request appears to come from the proxy, so all users share one bucket —
**the 5-per-hour email limiter becomes 5 per hour across the whole platform**, and ten
failed logins lock out everybody. Too high and a client can forge the header. Nothing
errors either way, which is why it is worth two minutes to check.

**How to check after deploying.** Every request log line carries an `ip` field. Call the
API from a known address — your phone on mobile data works, since it differs from your
home connection — and look at that line in the platform's log viewer:

- `ip` matches the address you called from → correct, nothing to do
- `ip` is something else, and identical across requests → raise `TRUST_PROXY` by one and
  restart

It is an environment variable rather than a constant precisely so this is a dashboard
change and a restart, not a commit and a redeploy.

`true` is not a valid value. It trusts the entire caller-supplied chain and makes the
limiters bypassable, so `src/config/env.ts` rejects any non-integer at boot.

### The rest

- **Set `NODE_ENV=production`.** It switches cookies to `secure` (HTTPS only) and stops
  5xx responses leaking internal detail.
- **Use a distinct `REFRESH_TOKEN_SECRET`.** It falls back to `JWT_SECRET`, which is fine
  for local work but means one leaked secret compromises both token types.
- **`CORS_ORIGIN` must list any origin calling the API directly.** Anything not listed
  gets a 403.
- **Rate limit counters are in-memory**, so they are per-process and reset on restart.
  Move to a shared store (Redis) before running more than one instance.

---

## Contributing

- Types stay strict — no `any` in new code without a comment saying why.
- Every request body goes through a Zod DTO in `src/dtos/`.
- Business logic lives in services, not controllers.
- Errors are thrown as `ApiError`; the global handler maps them to a response.
