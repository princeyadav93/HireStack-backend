import { Request, Response } from 'express';
import {
    uploadProfileImage,
    updateRecruiterProfileSection,
    getRecruiterProfile,
} from '../services/recruiterProfile.service';
import { asyncHandler } from '../utils/asyncHandler';
import { z } from 'zod';

/**
 * Upload recruiter profile image
 */
export const uploadProfileImageController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
            return;
        }

        const profile = await uploadProfileImage(userId, req.file);

        res.status(200).json({
            success: true,
            message: 'Profile image uploaded successfully',
            data: profile,
        });
    },
);

/**
 * Update recruiter personal info (title, department, bio, phone, etc.)
 */
export const updatePersonalInfo = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const PersonalInfoDTO = z.object({
            title: z.string().max(100).optional(),
            department: z.string().max(100).optional(),
            bio: z.string().max(500).optional(),
            phone: z
                .string()
                .regex(/^[0-9]{10,}$/)
                .optional(),
        });

        const parsedData = PersonalInfoDTO.parse(req.body);
        const updatedProfile = await updateRecruiterProfileSection(
            userId,
            parsedData,
        );

        res.status(200).json({
            success: true,
            message: 'Personal info updated successfully',
            data: updatedProfile,
        });
    },
);

/**
 * Update recruiter social links
 */
export const updateSocialLinks = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const SocialLinksDTO = z.object({
            socialLinks: z
                .object({
                    linkedin: z.string().optional(),
                    twitter: z.string().optional(),
                    website: z.string().url().optional(),
                })
                .optional(),
        });

        const parsedData = SocialLinksDTO.parse(req.body);
        const updatedProfile = await updateRecruiterProfileSection(
            userId,
            parsedData as any,
        );

        res.status(200).json({
            success: true,
            message: 'Social links updated successfully',
            data: updatedProfile,
        });
    },
);

/**
 * Get recruiter profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized',
        });
        return;
    }

    const profile = await getRecruiterProfile(userId);

    res.status(200).json({
        success: true,
        data: profile,
    });
});
