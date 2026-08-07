import { Request, Response } from 'express';
import {
    uploadProfileImage,
    updateRecruiterProfileSection,
    getRecruiterProfile,
} from '../services/recruiterProfile.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import { PersonalInfoDTO, SocialLinksDTO } from '../dtos/recruiterProfile.dto';

/**
 * Upload recruiter profile image
 */
export const uploadProfileImageController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!req.file) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No file uploaded');
        }

        const profile = await uploadProfileImage(userId, req.file);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                profile,
                'Profile image uploaded successfully',
            ),
        );
    },
);

/**
 * Update recruiter personal info (title, department, bio, phone, etc.)
 */
export const updatePersonalInfo = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsedData = PersonalInfoDTO.parse(req.body);
        const updatedProfile = await updateRecruiterProfileSection(
            userId,
            parsedData,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                updatedProfile,
                'Personal info updated successfully',
            ),
        );
    },
);

/**
 * Update recruiter social links
 */
export const updateSocialLinks = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsedData = SocialLinksDTO.parse(req.body);
        const updatedProfile = await updateRecruiterProfileSection(
            userId,
            parsedData as any,
        );

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                updatedProfile,
                'Social links updated successfully',
            ),
        );
    },
);

/**
 * Get recruiter profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id.toString();

    if (!userId) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
    }

    const profile = await getRecruiterProfile(userId);

    res.status(HTTP_STATUS.OK).json(
        new ApiResponse(
            HTTP_STATUS.OK,
            profile,
            'Profile retrieved successfully',
        ),
    );
});
