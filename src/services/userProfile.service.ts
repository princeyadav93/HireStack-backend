import cloudinary from '../config/cloudinary';
import { CandidateProfile } from '../models/userProfile.model';
import { ProfileDTO } from '../dtos/userProfile.dto';
import { normalize, buildUpdateQuery } from '../utils/userProfile.util';
import { Types } from 'mongoose';

export const uploadResume = async (
    userId: string,
    file: Express.Multer.File,
) => {
    if (!file) throw new Error('No file uploaded');

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

    try {
        const profile = await CandidateProfile.findOneAndUpdate(
            { user: new Types.ObjectId(userId) },
            {
                $set: {
                    user: new Types.ObjectId(userId),
                    'resume.url': result.secure_url,
                    'resume.uploadedAt': new Date(),
                },
            },
            {
                upsert: true,
                returnDocument: 'after',
                runValidators: true,
            },
        );
        return profile;
    } catch (err: any) {
        console.error('MONGO ERROR:', err);
        throw err;
    }
};

export const upsertProfileRepo = async (userId: string, updateQuery: any) => {
    return;
};

export const upsertProfileService = async (
    userId: string,
    rawData: unknown,
) => {
    // ✅ validate
    const parsed = ProfileDTO.parse(rawData);

    // ✅ normalize
    const data = normalize(parsed);

    // ✅ build query
    const updateQuery = buildUpdateQuery(data);

    // ✅ DB call
    const profile = await CandidateProfile.findOneAndUpdate(
        { user: new Types.ObjectId(userId) },
        {
            ...updateQuery,
            $setOnInsert: {
                user: new Types.ObjectId(userId),
                createdAt: new Date(),
            },
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
        },
    ).lean();

    return profile;
};
