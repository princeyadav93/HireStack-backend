import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    // Default to 500 if statusCode is missing
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log errors in development
    if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Error:', {
            statusCode,
            message,
            stack: err.stack,
        });
    }

    res.status(statusCode).json({
        success: false,
        message,
        // Include error array if present (for validation errors)
        ...(err.error && Array.isArray(err.error) && { errors: err.error }),
    });
};
