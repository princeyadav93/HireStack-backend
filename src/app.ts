import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { HTTP_STATUS } from './constants';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors());

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
import authRoutes from './routes/auth.route';
app.use('/auth', authRoutes);

// Candidate routes (registration only)
import candidateRouter from './routes/candidate.route';
import candidateProfileRouter from './routes/candidateProfile.route';
app.use('/candidate', candidateRouter);
app.use('/candidate/profile', candidateProfileRouter);

// Recruiter routes (registration only)
import recruiterRouter from './routes/recruiter.route';
import recruiterProfileRouter from './routes/recruiterProfile.route';
app.use('/recruiter', recruiterRouter);
app.use('/recruiter/profile', recruiterProfileRouter);

// Admin routes (registration for testing)
import adminRouter from './routes/platformAdmin.route';
app.use('/admin', adminRouter);

// company routes
import companyOwnerRouter from './routes/companyOwner.route';
import companyMemberRouter from './routes/companyMember.route';
app.use('/company', companyOwnerRouter);
app.use('/company', companyMemberRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);
export default app;
