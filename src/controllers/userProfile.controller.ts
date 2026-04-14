import { Request, Response } from 'express';
import { uploadResume } from '../services/userProfile.service';
import { updateProfileSection } from '../services/userProfile.service';
import { ZodType } from 'zod';
import { ICandidateProfile } from '../models/userProfile.model';
import { asyncHandler } from '../utils/asyncHandler';
import {
    BasicProfileDTO,
    ProjectsDTO,
    ExperienceDTO,
    EducationDTO,
    PreferencesDTO,
} from '../dtos/userProfile.dto';

export const uploadResumeController = asyncHandler(
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

        const profile = await uploadResume(userId, req.file);

        res.status(200).json({
            success: true,
            message: 'Resume uploaded successfully',
            data: profile,
        });
    },
);

export const createProfileUpdater = <T extends Partial<ICandidateProfile>>(
    schema: ZodType<T>,
) => {
    return asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const parsedData: T = schema.parse(req.body);

        const updatedProfile = await updateProfileSection(userId, parsedData);

        res.status(200).json({
            success: true,
            data: updatedProfile,
        });
    });
};

export const updateBasicProfile = createProfileUpdater(BasicProfileDTO);
export const updateProjects = createProfileUpdater(ProjectsDTO);
export const updateExperience = createProfileUpdater(ExperienceDTO);
export const updateEducation = createProfileUpdater(EducationDTO);
export const updatePreferences = createProfileUpdater(PreferencesDTO);
