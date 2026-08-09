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

/**
 * A company logo upload.
 *
 * Multer enforces the size ceiling first and rejects anything larger before the
 * buffer is ever held in memory; repeating it here keeps the DTO honest as the
 * single description of what the endpoint accepts.
 *
 * `mimetype` is client-supplied and trivially forged, so this is a usability
 * filter, not a security boundary — Cloudinary re-decodes the bytes and rejects
 * anything that is not really an image. SVG is deliberately excluded: it is a
 * document format that can carry script, and logos get rendered on pages we do
 * not control.
 */
export const CompanyLogoDTO = z.object({
    file: z
        .object({
            originalname: z.string(),
            mimetype: z.string(),
            size: z
                .number()
                .max(2 * 1024 * 1024, 'Logo must be 2MB or smaller'),
        })
        .refine(
            (file) =>
                ['image/png', 'image/jpeg', 'image/webp'].includes(
                    file.mimetype,
                ),
            {
                message:
                    'Invalid file type. Only PNG, JPEG and WebP images are allowed.',
            },
        ),
});

export type CompanyLogoType = z.infer<typeof CompanyLogoDTO>;
