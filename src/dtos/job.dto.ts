import { z } from 'zod';
import { EmploymentType, JobStatus, WorkMode } from '../constants/enums';

const locationSchema = z.object({
    city: z.string().trim().min(2).optional(),
    state: z.string().trim().optional(),
    country: z.string().trim().min(2).optional(),
});

const salarySchema = z
    .object({
        min: z.number().min(0).optional(),
        max: z.number().min(0).optional(),
        currency: z.string().trim().length(3).default('INR'),
    })
    .refine((s) => s.min === undefined || s.max === undefined || s.max >= s.min, {
        message: 'salary.max must be greater than or equal to salary.min',
    });

const experienceSchema = z
    .object({
        min: z.number().min(0).max(50).default(0),
        max: z.number().min(0).max(50).optional(),
    })
    .refine((e) => e.max === undefined || e.max >= e.min, {
        message: 'experience.max must be greater than or equal to experience.min',
    });

export const CreateJobDTO = z
    .object({
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().min(20).max(5000),
        employmentType: z.enum(EmploymentType),
        workMode: z.enum(WorkMode).default(WorkMode.ONSITE),
        location: locationSchema.optional(),
        skills: z
            .array(z.string().trim().toLowerCase().min(1))
            .min(1, 'At least one skill is required')
            .max(30),
        experience: experienceSchema.default({ min: 0 }),
        salary: salarySchema.optional(),
    })
    .strict();

export type CreateJobType = z.infer<typeof CreateJobDTO>;

// Status is deliberately absent: it moves through /publish and /close so the
// lifecycle rules cannot be bypassed with a PATCH.
export const UpdateJobDTO = z
    .object({
        title: z.string().trim().min(3).max(120).optional(),
        description: z.string().trim().min(20).max(5000).optional(),
        employmentType: z.enum(EmploymentType).optional(),
        workMode: z.enum(WorkMode).optional(),
        location: locationSchema.optional(),
        skills: z.array(z.string().trim().toLowerCase().min(1)).max(30).optional(),
        experience: experienceSchema.optional(),
        salary: salarySchema.optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field must be provided',
    });

export type UpdateJobType = z.infer<typeof UpdateJobDTO>;

/**
 * Query filters for the public job board. Everything arrives as a string, so
 * numbers are coerced and unknown keys are ignored rather than rejected.
 */
export const JobFilterDTO = z.object({
    search: z.string().trim().min(1).max(100).optional(),
    skills: z
        .string()
        .transform((s) =>
            s
                .split(',')
                .map((v) => v.trim().toLowerCase())
                .filter(Boolean),
        )
        .optional(),
    employmentType: z.enum(EmploymentType).optional(),
    workMode: z.enum(WorkMode).optional(),
    city: z.string().trim().toLowerCase().optional(),
    minExperience: z.coerce.number().min(0).max(50).optional(),
    maxSalary: z.coerce.number().min(0).optional(),
});

export type JobFilterType = z.infer<typeof JobFilterDTO>;

/** Company-side board: same filters, plus the ability to see drafts. */
export const CompanyJobFilterDTO = z.object({
    status: z.enum(JobStatus).optional(),
    search: z.string().trim().min(1).max(100).optional(),
});

export type CompanyJobFilterType = z.infer<typeof CompanyJobFilterDTO>;
