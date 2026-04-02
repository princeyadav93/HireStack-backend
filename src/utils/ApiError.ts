// src/utils/ApiError.ts
export class ApiError extends Error {
    statusCode: number;
    data: null;
    success: boolean;
    error: string[];

    constructor(
        statusCode: number,
        message: string = 'Something went wrong',
        errors: string[] = [],
        stack: string = '',
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.success = false;
        this.error = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
