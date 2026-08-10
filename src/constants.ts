const isProduction = process.env.NODE_ENV === 'production';

/**
 * Auth cookies.
 *
 * `sameSite: 'lax'` in every environment, and that is a deployment decision as
 * much as a code one.
 *
 * A browser only returns a cookie to the site that set it. With the frontend on
 * one host and this API on another, every credentialed call is cross-site and
 * the cookie is silently dropped — the user logs in and the next request
 * arrives anonymous. There are two ways out, and they are not equivalent:
 *
 *   1. Serve the frontend and the API from one origin, by having the frontend
 *      host proxy `/api/*` through to this service. Nothing is ever cross-site,
 *      so the question does not arise.
 *   2. `sameSite: 'none'`, which permits the cookie on cross-site requests —
 *      from *any* site, not just ours. That is CSRF: a third-party page can
 *      fire writes at this API and the browser attaches the user's session for
 *      it. Choosing this means also building token or origin checks on every
 *      state-changing route.
 *
 * This project takes (1) — see the deployment notes in README.md. It costs a
 * rewrite rule and removes the problem instead of answering it.
 *
 * `'strict'` was the previous production value. Under (1) it would work, but it
 * also withholds the cookie on top-level navigations *into* the app, so
 * arriving from a link in an email lands on a logged-out page that works after
 * a refresh. `lax` still blocks cross-site writes, since every state-changing
 * route here is POST/PATCH/DELETE. It is also what runs locally, so production
 * no longer behaves differently from the machine it was tested on — which is
 * the failure mode this whole comment exists to prevent.
 */
export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
};

/**
 * Deliberately not scoped with `path: '/auth/refresh-token'`.
 *
 * Narrowing the path would keep the refresh token off every other request,
 * which is worth having — but a cookie path is matched against the URL the
 * *browser* requests, and under the proxy above the browser asks for
 * `/api/auth/refresh-token` while this service only ever sees
 * `/auth/refresh-token`. The paths would never match and refresh would break in
 * production only. Restoring it means either pinning the frontend's URL prefix
 * in here or having the proxy preserve it.
 */
export const REFRESH_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    maxAge: 10 * 24 * 60 * 60 * 1000, // 10 days — matches REFRESH_TOKEN_EXPIRY
};

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    ALREADY_EXISTS: 409,
    PAYLOAD_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER: 500,
} as const;

// Pagination guard rails — an unbounded `limit` lets a caller pull the whole
// collection in one query.
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
} as const;
