import { Request, Response } from 'express';
import {
    uploadResume,
    uploadProfileImage,
    getCandidateProfile,
} from '../services/candidateProfile.service';
import { updateProfileSection } from '../services/candidateProfile.service';
import { ZodType } from 'zod';
import { ICandidateProfile } from '../models/candidateProfile.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { HTTP_STATUS } from '../constants';
import { ApiError } from '../utils/ApiError';
import {
    BasicProfileDTO,
    ProjectsDTO,
    ExperienceDTO,
    EducationDTO,
    PreferencesDTO,
} from '../dtos/candidateProfile.dto';

export const getCandidateProfileController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const profile = await getCandidateProfile(userId);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                profile,
                'Profile retrieved successfully',
            ),
        );
    },
);

export const uploadResumeController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        if (!req.file) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No file uploaded');
        }

        const profile = await uploadResume(userId, req.file);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                profile,
                'Resume uploaded successfully',
            ),
        );
    },
);

export const uploadProfileImageController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();

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

export const createProfileUpdater = <T extends Partial<ICandidateProfile>>(
    schema: ZodType<T>,
) => {
    return asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?._id?.toString();

        if (!userId) {
            throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
        }

        const parsedData: T = schema.parse(req.body);

        const updatedProfile = await updateProfileSection(userId, parsedData);

        res.status(HTTP_STATUS.OK).json(
            new ApiResponse(
                HTTP_STATUS.OK,
                updatedProfile,
                'Profile updated successfully',
            ),
        );
    });
};

// Candidate profile endpoints
export const updateBasicProfile = createProfileUpdater(BasicProfileDTO);
export const updateProjects = createProfileUpdater(ProjectsDTO);
export const updateExperience = createProfileUpdater(ExperienceDTO);
export const updateEducation = createProfileUpdater(EducationDTO);
export const updatePreferences = createProfileUpdater(PreferencesDTO);
