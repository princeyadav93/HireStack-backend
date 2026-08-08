# HireStack — Status & Roadmap

Last updated: 7 August 2026 · Branch: `dev`

A short read on where the backend stands, what to build next, and what could come later.
For setup and full API details see [README.md](./README.md).

---

## ✅ What's implemented

**53 endpoints across 9 modules**, plus a health check. All wired and reachable.

| Area                  | What works                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Auth**              | Register, login, logout, refresh-token rotation. JWT in httpOnly cookies. Logout revokes every existing token.          |
| **Candidates**        | Registration, full profile (skills, projects, experience, education, preferences), résumé + photo upload to Cloudinary. |
| **Recruiters**        | Self-registration, profile, avatar, social links.                                                                      |
| **Companies**         | Recruiter creates a company and becomes OWNER. Add/remove admins and recruiters, block/unblock members, edit company.   |
| **Platform admin**    | Approve, reject, suspend, unsuspend and soft-delete companies. Paginated audits of all companies and users.             |
| **Jobs**              | Full lifecycle `DRAFT → PUBLISHED → CLOSED`, soft delete, company board with drafts, and a public filtered job board.   |
| **Applications**      | Apply once per job, candidate's own list, recruiter pipeline per job, status transitions with a full audit trail.       |
| **Security**          | Rate limiting, helmet, CORS allowlist, Zod validation on every body, centralised error handling, tenant isolation.      |
| **Tests**             | 96 tests — Vitest, supertest, in-memory MongoDB replica set. Unit + integration, run in CI on every push.               |
| **Ops**               | Env validation on boot, admin seed script, GitHub Actions CI, protected `production` / `QA` / `dev` branches.           |

**The parts worth pointing at in an interview:**

- **Tenant isolation done properly.** Company scope is read from the caller's membership
  record in the database, never from a URL parameter — so IDs can't be tampered with.
  Foreign records return **404, not 403**, so the API won't even confirm they exist.
- **Application state is a table, not `if` statements.** One
  `ALLOWED_APPLICATION_TRANSITIONS` map defines every legal move; `HIRED` and `REJECTED`
  are terminal. Every change is appended to `statusHistory` with actor and timestamp.
- **Applying is transactional.** Creating the application and incrementing the job's
  counter happen together or not at all, and a unique `(jobId, candidateId)` index makes
  double-applying impossible even under a race.
- **Résumés are snapshotted onto the application** so a candidate can't rewrite what a
  recruiter already reviewed.
- **Company suspension takes effect instantly.** The public board joins to the company at
  query time, so suspending one hides all its jobs without touching a single job record.
- **Token confusion is blocked.** Access and refresh tokens carry a `type` claim, and a
  `tokenVersion` counter makes logout genuinely revoke.

---

## 🔜 What's next

In the order I'd do it.

### 1. Password reset and email verification

Right now anyone can register with **someone else's email address**, and a user who
forgets their password has no way back in. Needs: an email provider, a hashed
single-use token with a short expiry, and `/auth/forgot-password`,
`/auth/reset-password`, `/auth/verify-email`.

### 2. Two small production blockers

- **`app.set('trust proxy', 1)`** in `src/app.ts`. Without it, rate limiting behind a
  proxy sees the proxy's IP for every request and throttles all users as one.
- **Structured logging.** Morgan's `dev` format is unreadable in aggregation. Add
  request IDs and JSON output so production errors are traceable.

### 3. Company logo upload

The `Company` model already has a `logo` field with no endpoint filling it. Small job,
and the job board looks unfinished without it.

### 4. Replace the API collection with real docs

`API_TEST_COLLECTION.json` is stale and actively misleading — it documents endpoints
that don't exist, points at the wrong base URL, and uses bearer tokens when the API uses
cookies. Replace it with an OpenAPI spec generated from the Zod DTOs so it can't drift
again.

Deliberately last: steps 1 and 3 both add endpoints, so generating the spec before them
means regenerating it after.

---

## 🔭 What could come later

**Makes the product usable day to day**

- Saved / bookmarked jobs for candidates
- Email notifications on application status changes
- Candidate search for recruiters — the profile indexes on skills, role and location are
  already built but nothing queries them yet
- Recruiter notes and internal ratings on an application
- Withdraw an application
- Bulk pipeline actions (reject several candidates at once)

**Makes it feel like a real platform**

- Interview scheduling with calendar invites
- Résumé parsing to auto-fill candidate profiles
- Job views and conversion analytics
- Candidate ↔ job match scoring
- Full-text search via MongoDB Atlas Search
- In-app messaging between recruiter and candidate

**Bigger bets**

- The frontend — React, consuming this API
- Billing and subscriptions (OWNER-only), with plan-based job posting limits
- Company career pages on a public subdomain
- Team performance analytics — time-to-hire, funnel drop-off per recruiter
- ATS integrations (Greenhouse, Lever) and outbound webhooks
- A full audit log for admin actions

---

## ⚠️ Known gaps and debt

Small things, but they'll bite later if left.

| Item                                                                                             | Impact |
| ------------------------------------------------------------------------------------------------ | ------ |
| No password reset or email verification                                                            | High   |
| Test coverage is auth, applications and tenant isolation only — companies and profiles are untested | Medium |
| `REFRESH_TOKEN_SECRET` silently falls back to `JWT_SECRET`                                         | Medium |
| `app.set('trust proxy')` not configured — rate limiting misbehaves behind a proxy                  | Medium |
| `API_TEST_COLLECTION.json` documents endpoints that no longer exist                                | Medium |
| Membership recorded twice — in `Company.members` **and** the `CompanyMember` collection            | Medium |
| No account deletion or data export (GDPR)                                                          | Medium |
| Rate limit counters are in-memory — per-process, reset on restart, wrong for >1 instance            | Medium |
| Old Cloudinary files aren't cleaned up when a résumé or image is replaced                          | Low    |
| Several exported types and helpers are unused                                                      | Low    |
| No `.gitattributes` — Git warns about CRLF on every commit on Windows                              | Low    |
| CI pins Node 22 while local development is on Node 25                                              | Low    |

---

## Suggested order

```
✓  Tests                         ← 108 tests, running in CI
✓  Refresh-token hashing         ← SHA-256 + jti; rotation now actually revokes
1. Password reset + email verify ← the last thing missing before real users
2. trust proxy + logging         ← ~1 hour, blocks deployment
3. Company logo upload           ← small, visible win
4. OpenAPI docs                  ← last, so the spec captures the finished surface
5. Frontend                      ← the API surface is ready for it
```

The backend is in good shape to start a frontend against. Jobs and applications — the core
loop of a hiring product — are complete, enforced end to end, and now covered by tests that
run on every push. The suite has already paid for itself once: it caught a refresh-token
bug that had been invisible to manual testing.
