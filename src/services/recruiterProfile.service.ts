import cloudinary from '../config/cloudinary';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { Types } from 'mongoose';
import { IRecruiterProfile } from '../types/recruiter.types';
import { ClientSession } from 'mongoose';

/**
 * Upload recruiter profile image to Cloudinary
 */
export const uploadProfileImage = async (
    userId: string,
    file: Express.Multer.File,
) => {
    if (!file) throw new Error('No file uploaded');

    // Upload to cloudinary
    const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'recruiter_profiles' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            },
        );

        stream.end(file.buffer);
    });

    // Update profile with image
    const profile = await RecruiterProfile.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        {
            $set: {
                'profileImage.url': result.secure_url,
                'profileImage.fileName': file.originalname,
                'profileImage.uploadedAt': new Date(),
            },
        },
        {
            returnDocument: 'after',
            runValidators: true,
        },
    ).lean();

    if (!profile) {
        throw new Error('Profile not found. Create profile first.');
    }

    return profile;
};

/**
 * Update recruiter profile section
 */
export const updateRecruiterProfileSection = async (
    userId: string,
    data: Partial<IRecruiterProfile>,
): Promise<IRecruiterProfile> => {
    const updatedProfile = await RecruiterProfile.findOneAndUpdate(
        { user: userId },
        {
            $set: data,
        },
        { new: true, runValidators: true },
    );

    if (!updatedProfile) {
        throw new Error('Recruiter profile not found');
    }

    return updatedProfile;
};

/**
 * Get recruiter profile by userId
 */
export const getRecruiterProfile = async (userId: string) => {
    const profile = await RecruiterProfile.findOne({
        user: new Types.ObjectId(userId),
    });

    if (!profile) {
        throw new Error('Recruiter profile not found');
    }

    return profile;
};

/**
 * Check if recruiter profile exists
 */
export const recruiterProfileExists = async (
    userId: string,
): Promise<boolean> => {
    const profile = await RecruiterProfile.findOne({
        user: new Types.ObjectId(userId),
    });

    return !!profile;
};
