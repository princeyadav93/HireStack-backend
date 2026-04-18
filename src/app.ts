import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

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
    res.status(200).json({
        status: 'OK',
        message: 'Server is healthy',
    });
});

// route declarations
import candidateRouter from './routes/candidate.route';
import candidateProfileRouter from './routes/candidateProfile.route';
import recruiterRouter from './routes/recruiter.route';
import recruiterProfileRouter from './routes/recruiterProfile.route';
import companyRouter from './routes/company.route';

app.use('/candidate', candidateRouter);
app.use('/candidate/profile', candidateProfileRouter);
app.use('/recruiter', recruiterRouter);
app.use('/recruiter/profile', recruiterProfileRouter);
app.use('/company', companyRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);
export default app;
