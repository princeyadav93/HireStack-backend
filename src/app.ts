import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { ENV } from './config/env';
import { httpLogger } from './config/logger';
import { openApiDocument } from './docs/openapi';
import { HTTP_STATUS } from './constants';
import { ApiError } from './utils/ApiError';
import { globalLimiter } from './middleware/rateLimit.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';

import authRoutes from './routes/auth.route';
import candidateRouter from './routes/candidate.route';
import candidateProfileRouter from './routes/candidateProfile.route';
import recruiterRouter from './routes/recruiter.route';
import recruiterProfileRouter from './routes/recruiterProfile.route';
import adminRouter from './routes/platformAdmin.route';
import companyOwnerRouter from './routes/companyOwner.route';
import companyMemberRouter from './routes/companyMember.route';
import jobRouter from './routes/job.route';
import applicationRouter from './routes/application.route';

const app: Application = express();

/**
 * Trust exactly `TRUST_PROXY` proxy hops (default 1).
 *
 * On Render, Railway, Fly or behind nginx, nothing reaches this process
 * directly — the platform's load balancer does, and it puts the real client
 * address in `X-Forwarded-For`. Left unset, Express reports the balancer's IP
 * as `req.ip` for every request, and since the rate limiters key on `req.ip`
 * the whole internet shares one bucket: 300 requests in 15 minutes across all
 * users, then everyone is locked out together.
 *
 * A count, never `true`. `true` trusts the entire forwarded chain, which is
 * caller-supplied — anyone can send `X-Forwarded-For: <random>` and get a fresh
 * rate limit bucket per request, making the limiters decorative. A count reads
 * only the hops the infrastructure itself appended, which are the addresses a
 * client cannot forge. `env.ts` rejects a non-integer at boot so `true` cannot
 * be set here by accident.
 *
 * It is an environment variable because the correct number is a fact about the
 * deployment that cannot be known from the code: Render's balancer alone is 1,
 * a Vercel rewrite in front of it (see the deployment notes in README.md) is 2,
 * Cloudflare in front of that is 3. Nothing errors when it is wrong — the
 * symptom is every user sharing one rate-limit bucket — so measure it against
 * the `ip` field on a real request log line rather than guessing.
 */
app.set('trust proxy', ENV.TRUST_PROXY);

// Logging goes first, before anything that can reject a request.
//
// It attaches `req.id` and `req.log`, and everything downstream — including the
// CORS check and the rate limiter — can fail. Mounted any later, the requests
// most worth having a record of would be the ones that never got logged, and
// the error handler would reach for a `req.log` that was never attached.
app.use(httpLogger);

// Security middleware
app.use(helmet());

// CORS — auth is cookie-based, so the origin list must be explicit. A wildcard
// origin cannot be combined with credentials, and allowing every site to make
// credentialed calls to this API would defeat the point of httpOnly cookies.
const allowedOrigins = ENV.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // No Origin header: same-origin, curl, Postman, server-to-server.
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) return callback(null, true);

            return callback(
                new ApiError(
                    HTTP_STATUS.FORBIDDEN,
                    'Not allowed by CORS policy',
                ),
            );
        },
        credentials: true,
    }),
);

// Baseline request ceiling; tighter limits sit on the auth routes themselves.
app.use(globalLimiter);

// Body parser
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.json({ limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

/**
 * API documentation.
 *
 * Served by the app itself rather than published separately, so the docs are
 * always the docs for the build that is running — a spec deployed out-of-band
 * is a spec that will eventually describe last month's API.
 *
 * helmet's default CSP blocks the inline styles Swagger UI injects, so it is
 * relaxed for this route only, not globally.
 */
app.use(
    '/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
        customSiteTitle: 'HireStack API',
        // Auth is cookie-based, so the browser must send credentials for
        // "Try it out" to work at all.
        swaggerOptions: { withCredentials: true, persistAuthorization: true },
    }),
);

// The raw document, for client generators and other tooling.
app.get('/docs.json', (_, res) => {
    res.status(HTTP_STATUS.OK).json(openApiDocument);
});

// Health check
app.get('/', (_, res) => {
    res.status(HTTP_STATUS.OK).json({
        status: 'OK',
        message: 'Server is healthy',
    });
});

// route declarations

// Global auth routes (login/logout for all roles)
app.use('/auth', authRoutes);

// Candidate routes (registration only)
app.use('/candidate', candidateRouter);
app.use('/candidate/profile', candidateProfileRouter);

// Recruiter routes (registration only)
app.use('/recruiter', recruiterRouter);
app.use('/recruiter/profile', recruiterProfileRouter);

// Platform admin routes
app.use('/admin', adminRouter);

// Company routes.
// ORDER MATTERS: companyOwnerRouter owns `GET /:companyId`, which matches any
// single-segment path. It must be mounted last or it swallows sibling literal
// routes such as `GET /company/members`.
app.use('/company', companyMemberRouter);
app.use('/company', companyOwnerRouter);

// Jobs and applications
app.use('/jobs', jobRouter);
app.use('/applications', applicationRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
