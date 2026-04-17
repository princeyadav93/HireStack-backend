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
import userRouter from './routes/user.route';
import userProfileRouter from './routes/userProfile.route';
import recruiterRouter from './routes/recruiter.route';
import companyRouter from './routes/company.route';

app.use('/user', userRouter);
app.use('/user/profile', userProfileRouter);
app.use('/recruiter', recruiterRouter);
app.use('/company', companyRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);
export default app;
