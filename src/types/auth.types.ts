/**
 * Authentication Types
 */

/**
 * Registration Input Type
 */
export interface RegisterInput {
    name: string;
    email: string;
    password: string;
}

/**
 * Login Input Type
 */
export interface LoginInput {
    email: string;
    password: string;
}

/**
 * JWT Payload Type
 */
export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * JWT Token Response
 */
export interface JwtTokens {
    accessToken: string;
    refreshToken: string;
}

/**
 * Authentication Response
 */
export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
        user: {
            _id: string;
            name: string;
            email: string;
            role: string;
        };
        accessToken?: string;
        refreshToken?: string;
    };
}

/**
 * Token Request Type (for refresh token)
 */
export interface TokenRefreshRequest {
    refreshToken: string;
}

/**
 * Cookie Options Type
 */
export interface CookieOptions {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge: number;
}
