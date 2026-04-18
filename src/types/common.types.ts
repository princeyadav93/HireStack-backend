/**
 * Common Types used across the application
 */

/**
 * API Response Type (standard response format for all endpoints)
 */
export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    errors?: string[];
    statusCode?: number;
}

/**
 * Paginated Response Type
 */
export interface PaginatedResponse<T> {
    success: boolean;
    message: string;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

/**
 * Error Response Type
 */
export interface ErrorResponse {
    success: false;
    message: string;
    errors?: string[];
    statusCode: number;
}

/**
 * Request User Type (attached to Express Request)
 */
export interface RequestUser {
    id: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * Pagination Query Type
 */
export interface PaginationQuery {
    page?: number;
    limit?: number;
    skip?: number;
}

/**
 * Sort Options Type
 */
export interface SortOptions {
    field: string;
    order: 'asc' | 'desc' | 1 | -1;
}

/**
 * Filter Base Type
 */
export interface FilterBase {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
}

/**
 * Http Status Codes Enum
 */
export enum HttpStatusCode {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    INTERNAL_SERVER_ERROR = 500,
}

/**
 * File Upload Type
 */
export interface UploadedFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
    path?: string;
}

/**
 * File Upload Response Type
 */
export interface FileUploadResponse {
    fileName: string;
    url: string;
    uploadedAt: Date;
    mimeType: string;
    size: number;
}

/**
 * Audit Trail Type
 */
export interface AuditTrail {
    action: string;
    performedBy: string;
    performedAt: Date;
    changes?: Record<string, any>;
    reason?: string;
}

/**
 * Soft Delete Type
 */
export interface SoftDeletable {
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: string;
}

/**
 * Timestamps Type
 */
export interface Timestamps {
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Search Result Type
 */
export interface SearchResult<T> {
    items: T[];
    total: number;
    query: string;
    matchedFields: string[];
}

/**
 * Notification Type
 */
export interface Notification {
    _id?: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
    isRead: boolean;
    createdAt: Date;
}

/**
 * Bulk Operation Result Type
 */
export interface BulkOperationResult {
    success: number;
    failed: number;
    total: number;
    errors?: Array<{
        index: number;
        error: string;
    }>;
}
