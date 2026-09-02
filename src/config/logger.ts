import { randomUUID } from 'crypto';
import type { Request } from 'express';
import pino from 'pino';
import pinoHttp, { type Options } from 'pino-http';
import { ENV } from './env';

/**
 * Logging.
 *
 * One rule decides everything here: the app writes JSON to stdout and nothing
 * else. It does not open log files, rotate them, or ship them anywhere. That is
 * the platform's job — Render, Railway, Fly and every container runtime capture
 * a process's stdout, and a process that manages its own log files cannot be
 * restarted or scaled without losing them.
 *
 * The payoff is that logs stay searchable. `console.log` writes a sentence a
 * human reads one at a time; JSON writes fields a log viewer can filter on, so
 * "every 500 on /auth/login in the last hour" is a query rather than a scroll.
 */

const isProduction = ENV.NODE_ENV === 'production';
const isTest = ENV.NODE_ENV === 'test';

// Tests assert on responses, not output, and 144 files of request logs bury the
// one failure that matters.
const level = ENV.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug');

export const logger = pino({
    level,

    // Pretty-printing costs a worker thread and exists purely for human eyes,
    // so it stays out of production — where the whole point is machine-readable
    // output — and out of tests, which log nothing.
    transport:
        isProduction || isTest
            ? undefined
            : {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'HH:MM:ss' },
              },

    // Anything listed here is replaced with [Redacted] before it is written.
    //
    // This is not housekeeping. Auth is cookie-based, so every single request
    // carries an access token in `cookie` — logging request headers unredacted
    // would copy a valid credential for every user into the log store, where it
    // outlives the session and is readable by anyone with dashboard access.
    // Treat a log line as permanently public and this becomes obvious.
    redact: {
        paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
        ],
        censor: '[Redacted]',
    },

    // `level: "info"` is friendlier to log viewers than pino's numeric default.
    formatters: { level: (label) => ({ level: label }) },
});

/**
 * Everything about the access log except which logger receives the line.
 *
 * Split out so a test can mount the identical middleware against a stream it
 * can read: `logger` is silent under NODE_ENV=test and writes straight to a
 * file descriptor otherwise, so there is no other way to assert on what a line
 * actually contains.
 */
export const httpLoggerOptions = {
    /**
     * The request id is the entire reason for doing this.
     *
     * Every line logged during one request carries the same `req.id`, so a 500
     * in the error handler can be traced back to the request that caused it —
     * even with hundreds of users interleaved in one stream. Without it, a
     * production stack trace is an orphan you cannot attach to anything.
     *
     * An inbound `x-request-id` wins so the id survives across services: if a
     * proxy or a frontend already started a trace, we join it instead of
     * beginning a new one.
     */
    genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const id =
            (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();

        // Echoed back so a user reporting a bug can quote the exact id, and it
        // lands straight on the request that failed.
        res.setHeader('x-request-id', id);
        return id;
    },

    // A 404 or a 401 is a client mistake, not a server fault. Logging both at
    // `info` makes real failures impossible to spot; separating them means
    // filtering to `level >= error` shows only things that are our problem.
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },

    autoLogging: {
        // The health check. Free hosting tiers idle a service out after a few
        // minutes, so the usual fix is an uptime pinger hitting `/` on a
        // schedule — which, logged, is thousands of identical lines a day
        // drowning the traffic you actually care about.
        ignore: (req) => req.url === '/',
    },

    // Attached when the response finishes, which is the only moment req.user
    // exists: httpLogger is mounted first in app.ts, ahead of verifyJWT.
    //
    // The obvious home for this is the `req` serializer below, and it does not
    // work there. pino-http serialises the request once on the way in, before
    // any other middleware has run, and reuses that result — so `req.raw.user`
    // is always undefined and the field silently never appears. Verified, not
    // assumed; it is exactly the kind of always-null field that reads as
    // working.
    //
    // This is the cheapest identity the API has: no schema change and no extra
    // write, and it answers "who closed that job" for every action whose own
    // record never captured an actor. Anonymous routes omit the field.
    customProps: (req) => ({
        userId: (req as unknown as Request).user?._id?.toString(),
    }),

    // The defaults serialise the entire req/res object. These are the fields
    // anyone actually reads, and a smaller line is a cheaper line once a log
    // provider starts charging by volume.
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            // Populated only because `trust proxy` is set in app.ts. Without
            // it this is the proxy's address on every request.
            ip: req.raw?.ip,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
    },
} satisfies Options;

export const httpLogger = pinoHttp({ logger, ...httpLoggerOptions });
