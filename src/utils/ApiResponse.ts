/**
 * Centralized API Response class for successful responses
 * Provides a consistent structure for all successful API responses
 */
export class ApiResponse<T = any> {
    statusCode: number;
    data: T;
    message: string;
    success: boolean;

    constructor(statusCode: number, data: T, message: string = 'Success') {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}
