import { z } from 'zod';
import { ApplicationStatus } from '../constants/enums';

export const ApplyToJobDTO = z
    .object({
        coverLetter: z.string().trim().max(2000).optional(),
    })
    .strict();

export type ApplyToJobType = z.infer<typeof ApplyToJobDTO>;

export const UpdateApplicationStatusDTO = z
    .object({
        status: z.enum(ApplicationStatus),
        note: z.string().trim().max(500).optional(),
    })
    .strict();

export type UpdateApplicationStatusType = z.infer<
    typeof UpdateApplicationStatusDTO
>;

export const ApplicationFilterDTO = z.object({
    status: z.enum(ApplicationStatus).optional(),
});

export type ApplicationFilterType = z.infer<typeof ApplicationFilterDTO>;
