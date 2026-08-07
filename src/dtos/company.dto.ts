import { z } from 'zod';

export const CreateCompanyDTO = z.object({
    name: z
        .string()
        .min(2, 'Company name must be at least 2 characters')
        .max(100),
    industry: z.string().min(2, 'Industry must be at least 2 characters'),
    size: z
        .enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'])
        .default('STARTUP'),
    description: z
        .string()
        .max(500, 'Description must not exceed 500 characters')
        .optional(),
    website: z.string().url('Please provide a valid URL').optional(),
    location: z
        .object({
            city: z.string().min(2, 'City must be at least 2 characters'),
            state: z.string().optional(),
            country: z.string().min(2, 'Country must be at least 2 characters'),
        })
        .optional(),
});

export type CreateCompanyType = z.infer<typeof CreateCompanyDTO>;

export const CreateAdminDTO = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must not exceed 50 characters'),
    email: z.email('Invalid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateAdminType = z.infer<typeof CreateAdminDTO>;

export const CreateRecruiterDTO = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must not exceed 50 characters'),
    email: z.email('Invalid email address').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateRecruiterType = z.infer<typeof CreateRecruiterDTO>;

export const DeleteMemberDTO = z.object({
    memberId: z.string().min(1, 'Member ID is required'),
});

export type DeleteMemberType = z.infer<typeof DeleteMemberDTO>;

export const UpdateCompanyDTO = z.object({
    name: z.string().min(2).max(100).trim().optional(),
    industry: z.string().trim().optional(),
    size: z
        .enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'])
        .optional(),
    description: z.string().max(500).trim().optional(),
    website: z.string().url().optional(),
    location: z
        .object({
            city: z.string().trim(),
            state: z.string().trim().optional(),
            country: z.string().trim(),
        })
        .optional(),
});

export type UpdateCompanyType = z.infer<typeof UpdateCompanyDTO>;
