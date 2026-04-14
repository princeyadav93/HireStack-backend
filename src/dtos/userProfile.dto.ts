import { z } from 'zod';

export const ResumeDTO = z.object({
    file: z
        .object({
            originalname: z.string(),
            mimetype: z.string(),
            size: z.number().max(2 * 1024 * 1024), // 2MB limit (aligned with multer)
        })
        .refine(
            (file) =>
                [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                ].includes(file.mimetype),
            {
                message:
                    'Invalid file type. Only PDF and Word documents allowed.',
            },
        ),
});

// Export ProfileInput type for external validation
export type ProfileInput = z.infer<typeof BasicProfileDTO> &
    z.infer<typeof ProjectsDTO> &
    z.infer<typeof ExperienceDTO> &
    z.infer<typeof EducationDTO> &
    z.infer<typeof PreferencesDTO>;

export const BasicProfileDTO = z.object({
    skills: z.array(z.string().trim().toLowerCase()).optional(),

    github: z
        .url()
        .regex(/github\.com/, 'Invalid GitHub URL')
        .optional(),

    linkedin: z
        .url()
        .regex(/linkedin\.com/, 'Invalid LinkedIn URL')
        .optional(),
});

export const ProjectsDTO = z
    .object({
        projects: z
            .array(
                z.object({
                    projectUrl: z.url().optional(),
                    projectName: z.string().min(1),
                    projectDesc: z.string().optional(),

                    // 🔥 IMPORTANT FIX
                    techStack: z
                        .array(z.string().trim().toLowerCase())
                        .default([]),
                }),
            )
            .optional(),
    })
    .strict();

const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((val) => new Date(val));
export const ExperienceDTO = z
    .object({
        experience: z
            .array(
                z.object({
                    company: z.string().min(1),
                    role: z.string().min(1),

                    // 🔥 FIX: frontend sends string, not Date object
                    startDate: isoDate,

                    endDate: isoDate.optional(),
                }),
            )
            .optional(),
    })
    .strict();

export const EducationDTO = z
    .object({
        education: z
            .array(
                z.object({
                    degree: z.string(),
                    college: z.string(),
                    year: z.number(),
                }),
            )
            .optional(),
    })
    .strict();

export const PreferencesDTO = z
    .object({
        preferences: z.object({
            desiredRole: z.string(),
            expectedSalary: z.number().min(0).optional(),
            locations: z.array(z.string().trim().toLowerCase()),
            remote: z.boolean().optional(),
            jobType: z.enum(['FULL_TIME', 'PART_TIME', 'INTERNSHIP']),
        }),
    })
    .strict();
