export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true, // set true in production (HTTPS only)
    sameSite: 'lax' as const,
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
    INTERNAL_SERVER: 500,
} as const;
