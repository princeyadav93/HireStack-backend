import { z } from 'zod';

export const ProfileDTO = z.object({
    skills: z.array(z.string()).optional(),

    github: z.string().url().optional(),
    linkedin: z.string().url().optional(),

    preferences: z
        .object({
            desiredRole: z.string().optional(),
            expectedSalary: z.number().min(0).optional(),
            locations: z.array(z.string()).optional(),
            remote: z.boolean().optional(),
            jobType: z
                .enum(['FULL_TIME', 'PART_TIME', 'INTERNSHIP'])
                .optional(),
        })
        .optional(),
});

export type ProfileInput = z.infer<typeof ProfileDTO>;
