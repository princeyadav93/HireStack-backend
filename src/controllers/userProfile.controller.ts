import { Request, Response } from 'express';
import { uploadResume } from '../services/userProfile.service';
import { upsertProfileService } from '../services/userProfile.service';
import console from 'console';

export const uploadResumeController = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const file = req.file;

        const profile = await uploadResume(userId, file!);

        return res.status(200).json({
            message: 'Resume uploaded',
            profile,
        });
    } catch (err) {
        return res.status(500).json({
            message: 'Upload failed',
            err,
        });
    }
};

export const upsertProfileController = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const profile = await upsertProfileService(userId, req.body);

        return res.status(200).json({
            message: 'Profile saved',
            profile,
        });
    } catch (err: any) {
        return res.status(400).json({
            message: err.message || 'Failed to update profile',
        });
    }
};
