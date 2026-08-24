import { CompanyMemberRole } from './companyMember.types';
import { CompanyStatus } from './company.types';
import { IUser } from './user.types';

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
 * Token kind — carried in every token so a refresh token can never be
 * replayed as an access token (both may be signed with the same secret).
 */
export const TOKEN_TYPE = {
    ACCESS: 'access',
    REFRESH: 'refresh',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];

/**
 * JWT Payload Type
 */
export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    tokenVersion: number;
    type: TokenType;
    iat?: number;
    exp?: number;
}

/**
 * Refresh token payload — deliberately minimal.
 */
export interface RefreshPayload {
    userId: string;
    type: TokenType;
    /** Unique per issue, so no two refresh tokens are ever byte-identical. */
    jti?: string;
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

/**
 * What `GET /auth/me` answers.
 *
 * Deliberately assembled from three collections into one response: a client
 * needs all of it before it can draw a signed-in shell, and making it fetch
 * the pieces separately means inferring the company from a list endpoint —
 * the shape that ends with a company id travelling in a URL.
 */
export interface CurrentUserMembership {
    companyId: string;
    companyName: string;
    /** Jobs cannot be published until this is `approved`. */
    companyStatus: CompanyStatus;
    role: CompanyMemberRole;
    /** False once an owner or admin has blocked the member. */
    isActive: boolean;
}

export interface CurrentUser {
    user: IUser;
    /** Null for a candidate or a platform admin — neither belongs to one. */
    membership: CurrentUserMembership | null;
    /** Candidates only; nothing computes a completion figure for anyone else. */
    profileCompletion: number | null;
}
