import { z } from 'zod';

// Recruiter Profile DTOs
// Note: Recruiter profiles are created automatically when a company is created.
// Future DTOs for profile management will be added here.

export const PersonalInfoDTO = z.object({
    title: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    phone: z
        .string()
        .regex(/^[0-9]{10,}$/)
        .optional(),
});

export const SocialLinksDTO = z.object({
    socialLinks: z
        .object({
            linkedin: z.string().optional(),
            twitter: z.string().optional(),
            website: z.url().optional(),
        })
        .optional(),
});
