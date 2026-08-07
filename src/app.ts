import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env';
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

const app: Application = express();

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

// Logging
app.use(morgan('dev'));

// Body parser
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.json({ limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

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

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
