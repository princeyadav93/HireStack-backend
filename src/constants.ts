// Dynamic CORS: require production HTTPS for cookies
const isProduction = process.env.NODE_ENV === 'production';

export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? ('strict' as const) : ('lax' as const),
    maxAge: 24 * 60 * 60 * 1000, // 1 day
};

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    ALREADY_EXISTS: 409,
    PAYLOAD_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER: 500,
} as const;

// Pagination guard rails — an unbounded `limit` lets a caller pull the whole
// collection in one query.
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
} as const;
