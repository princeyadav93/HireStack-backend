import rateLimit, { Options } from 'express-rate-limit';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Rate limiting.
 *
 * NOTE ON DEPLOYMENT: limits are keyed on the client IP. Behind a proxy or load
 * balancer (nginx, Render, Railway, Cloudflare) every request arrives from the
 * proxy's IP, so all users share one bucket. Set `app.set('trust proxy', 1)` in
 * app.ts once you know how many proxies sit in front of the app — do not set it
 * to `true`, which lets a caller spoof their IP via X-Forwarded-For and bypass
 * these limits entirely.
 *
 * The store is in-memory, so counters are per-process and reset on restart.
 * Move to a shared store (Redis) before running more than one instance.
 */

const rejectWithApiError: Options['handler'] = (_req, _res, next) => {
    next(
        new ApiError(
            HTTP_STATUS.TOO_MANY_REQUESTS,
            'Too many requests. Please try again later.',
        ),
    );
};

/**
 * The whole test suite shares one process and one client IP, so a full run
 * burns through these budgets and unrelated assertions start failing as 429s.
 *
 * Both variables must agree before limiting is skipped — NODE_ENV=test
 * reaching production by accident is not enough to disable it on its own.
 */
const rateLimitingDisabled = () =>
    process.env.NODE_ENV === 'test' &&
    process.env.DISABLE_RATE_LIMIT === 'true';

const baseOptions = {
    standardHeaders: 'draft-7' as const,
    legacyHeaders: false,
    handler: rejectWithApiError,
    skip: rateLimitingDisabled,
};

/**
 * Login and refresh: the endpoints worth guessing against.
 * Successful logins are not counted, so a legitimate user is never locked out
 * by their own activity — only repeated failures burn the budget.
 */
export const authLimiter = rateLimit({
    ...baseOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,
    skipSuccessfulRequests: true,
});

/**
 * Account creation: slower still, since each success writes to the database.
 */
export const registerLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 20,
});

/**
 * Catch-all ceiling for everything else.
 */
export const globalLimiter = rateLimit({
    ...baseOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 300,
});
