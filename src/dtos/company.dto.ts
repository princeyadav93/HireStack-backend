import { z } from 'zod';

/**
 * DTO for creating a new company
 * Only recruiters can create companies, and each recruiter can only create ONE company
 */
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
