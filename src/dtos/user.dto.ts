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
