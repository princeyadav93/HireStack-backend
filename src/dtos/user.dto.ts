import { z } from 'zod';

export const RegisterDTO = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, 'Name is required')
            .max(100, 'Name too long'),

        email: z.email('Invalid email').trim().toLowerCase(),

        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .max(100, 'Password too long'),
    })
    .strict();

export const LoginDTO = z
    .object({
        email: z.email('Invalid email').trim().toLowerCase(),

        password: z.string().min(1, 'Password is required'),
    })
    .strict();

// The token arrives from a link the frontend read out of the query string.
// Only its presence is checked here — whether it is real is decided by looking
// it up, and a length or shape rule would just reject some invalid tokens
// earlier with a different message.
const TokenField = z.string().trim().min(1, 'Token is required');

export const ForgotPasswordDTO = z
    .object({
        email: z.email('Invalid email').trim().toLowerCase(),
    })
    .strict();

export const ResetPasswordDTO = z
    .object({
        token: TokenField,

        // Same rule as registration: a reset must not be a way around the
        // password policy.
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .max(100, 'Password too long'),
    })
    .strict();

export const VerifyEmailDTO = z
    .object({
        token: TokenField,
    })
    .strict();
