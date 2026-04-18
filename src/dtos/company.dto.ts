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

export const JoinCompanyDTO = z.object({
    invitationCode: z.string().optional(),
});

export type JoinCompanyType = z.infer<typeof JoinCompanyDTO>;

export const InviteRecruiterDTO = z.object({
    recruiterId: z.string().min(1, 'Recruiter ID is required'),
});

export type InviteRecruiterType = z.infer<typeof InviteRecruiterDTO>;

export const ApproveMemberDTO = z.object({
    memberId: z.string().min(1, 'Member ID is required'),
});

export type ApproveMemberType = z.infer<typeof ApproveMemberDTO>;

export const RejectMemberDTO = z.object({
    memberId: z.string().min(1, 'Member ID is required'),
    reason: z.string().min(1, 'Reason is required').max(200),
});

export type RejectMemberType = z.infer<typeof RejectMemberDTO>;

export const RemoveMemberDTO = z.object({
    memberId: z.string().min(1, 'Member ID is required'),
    reason: z.string().min(1, 'Reason is required').max(200),
});

export type RemoveMemberType = z.infer<typeof RemoveMemberDTO>;

export const ChangeMemberRoleDTO = z.object({
    memberId: z.string().min(1, 'Member ID is required'),
    newRole: z.enum(['OWNER', 'ADMIN', 'RECRUITER']),
});

export type ChangeMemberRoleType = z.infer<typeof ChangeMemberRoleDTO>;

export const DelegateBillingAdminDTO = z.object({
    adminId: z.string().min(1, 'Admin ID is required'),
});

export type DelegateBillingAdminType = z.infer<typeof DelegateBillingAdminDTO>;
