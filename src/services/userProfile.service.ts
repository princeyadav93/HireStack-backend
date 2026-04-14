import cloudinary from '../config/cloudinary';
import { CandidateProfile } from '../models/userProfile.model';
import { buildUpdateQuery } from '../utils/userProfile.util';
import { Types } from 'mongoose';
import { ICandidateProfile } from '../models/userProfile.model';
import { calculateProfileCompletion } from '../utils/userProfile.util';
import { ClientSession } from 'mongoose';
import { ResumeDTO } from '../dtos/userProfile.dto';

export const uploadResume = async (
    userId: string,
    file: Express.Multer.File,
) => {
    ResumeDTO.parse({ file });

    console.log('resume', file);

    if (!file) throw new Error('No file uploaded');

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
        throw new Error('Profile not found. Create profile first.');
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
        throw new Error('Profile not found');
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
