import cloudinary from '../config/cloudinary';
import { CandidateProfile } from '../models/candidateProfile.model';
import { buildUpdateQuery } from '../utils/candidateProfile.util';
import { Types } from 'mongoose';
import { ICandidateProfile } from '../models/candidateProfile.model';
import { calculateProfileCompletion } from '../utils/candidateProfile.util';
import { ClientSession } from 'mongoose';
import { ResumeDTO } from '../dtos/candidateProfile.dto';
import { ApiError } from '../utils/ApiError';

export const getCandidateProfile = async (userId: string) => {
    const profile = await CandidateProfile.findOne({ user: userId }).lean();

    if (!profile) {
        throw new ApiError(404, 'Profile not found');
    }

    return profile;
};

export const uploadResume = async (
    userId: string,
    file: Express.Multer.File,
) => {
    ResumeDTO.parse({ file });

    if (!file) throw new ApiError(400, 'No file uploaded');

    // ✅ upload to cloudinary
    const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'raw', folder: 'resumes' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            },
        );

        stream.end(file.buffer);
    });

    // ✅ PATCH-style update
    const profile = await CandidateProfile.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        {
            $set: {
                'resume.url': result.secure_url,
                'resume.fileName': file.originalname,
                'resume.uploadedAt': new Date(),
            },
        },
        {
            returnDocument: 'after',
            runValidators: true,
        },
    ).lean();

    // 🚨 IMPORTANT: handle missing profile
    if (!profile) {
        throw new ApiError(404, 'Profile not found. Create profile first.');
    }

    return profile;
};

export const uploadProfileImage = async (
    userId: string,
    file: Express.Multer.File,
) => {
    if (!file) throw new ApiError(400, 'No file uploaded');

    // ✅ upload to cloudinary (images folder)
    const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'profile-images' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            },
        );

        stream.end(file.buffer);
    });

    // ✅ PATCH-style update
    const profile = await CandidateProfile.findOneAndUpdate(
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

    // 🚨 IMPORTANT: handle missing profile
    if (!profile) {
        throw new ApiError(404, 'Profile not found. Create profile first.');
    }

    return profile;
};

// export const uploadResume = async (
//     userId: string,
//     file: Express.Multer.File,
// ) => {
//     if (!file) throw new Error('No file uploaded');

//     const result = await new Promise<any>((resolve, reject) => {
//         const stream = cloudinary.uploader.upload_stream(
//             { resource_type: 'raw', folder: 'resumes' },
//             (error, result) => {
//                 if (error) reject(error);
//                 else resolve(result);
//             },
//         );

//         stream.end(file.buffer);
//     });

//     try {
//         const profile = await CandidateProfile.findOneAndUpdate(
//             { user: new Types.ObjectId(userId) },
//             {
//                 $set: {
//                     user: new Types.ObjectId(userId),
//                     'resume.url': result.secure_url,
//                     'resume.uploadedAt': new Date(),
//                 },
//             },
//             {
//                 upsert: true,
//                 returnDocument: 'after',
//                 runValidators: true,
//             },
//         );
//         return profile;
//     } catch (err: any) {
//         console.error('MONGO ERROR:', err);
//         throw err;
//     }
// };

// profile.service.ts

export const updateProfileSection = async (
    userId: string,
    data: Partial<ICandidateProfile>,
): Promise<ICandidateProfile> => {
    const updateQuery = buildUpdateQuery(data);

    const updatedProfile = await CandidateProfile.findOneAndUpdate(
        { user: userId },
        updateQuery,
        { new: true, runValidators: true }, // ✅ Enforce schema validation
    );

    if (!updatedProfile) {
        throw new ApiError(404, 'Profile not found');
    }

    const completion = calculateProfileCompletion(updatedProfile);

    if (completion !== updatedProfile.profileCompletion) {
        updatedProfile.profileCompletion = completion;
        await updatedProfile.save();
    }

    return updatedProfile;
};

export const createProfileIfNotExists = async (
    userId: string,
    session?: ClientSession,
) => {
    return await CandidateProfile.findOneAndUpdate(
        { user: userId },
        {
            $setOnInsert: {
                user: userId,
                profileCompletion: 0,
            },
        },
        {
            new: true,
            upsert: true,
            session, // 🔥 IMPORTANT
        },
    );
};
