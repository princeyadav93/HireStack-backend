// src/models/candidateProfile.model.ts

import mongoose, { Schema } from 'mongoose';
import { ICandidateProfile } from '../types/candidate.types';

const candidateProfileSchema = new Schema<ICandidateProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // one profile per user
            index: true,
        },

        skills: [
            {
                type: String,
                lowercase: true,
                trim: true,
            },
        ],

        projects: [
            {
                _id: false,
                projectUrl: { type: String, trim: true },
                projectName: { type: String, required: true, trim: true },
                projectDesc: { type: String, trim: true },
                techStack: {
                    type: [String],
                    default: [],
                },
            },
        ],

        resume: {
            url: { type: String },
            // uploadResume writes this; without it in the schema Mongoose's
            // strict mode silently discarded the original filename.
            fileName: { type: String },
            uploadedAt: { type: Date },
        },

        profileImage: {
            url: String,
            fileName: String,
            uploadedAt: Date,
        },

        github: {
            type: String,
            trim: true,
            match: /^(https?:\/\/)?(www\.)?github\.com\/.+$/i,
        },

        linkedin: {
            type: String,
            trim: true,
            match: /^(https?:\/\/)?(www\.)?linkedin\.com\/.+$/i,
        },

        preferences: {
            desiredRole: { type: String, trim: true },
            expectedSalary: { type: Number },
            locations: [
                {
                    type: String,
                    lowercase: true,
                    trim: true,
                },
            ],
            remote: { type: Boolean, default: false },
            jobType: {
                type: String,
                enum: ['FULL_TIME', 'PART_TIME', 'INTERNSHIP'],
            },
        },

        experience: [
            {
                _id: false,
                company: { type: String, required: true, trim: true },
                role: { type: String, required: true, trim: true },
                startDate: { type: Date, required: true },
                endDate: { type: Date },
            },
        ],

        education: [
            {
                _id: false,
                degree: { type: String, trim: true },
                college: { type: String, trim: true },
                year: { type: Number },
            },
        ],

        profileCompletion: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    },
);

// Single field indexes
candidateProfileSchema.index({ skills: 1 });
candidateProfileSchema.index({ 'preferences.desiredRole': 1 });
candidateProfileSchema.index({ 'preferences.locations': 1 });
candidateProfileSchema.index({ 'preferences.remote': 1 });

// Compound index for search

export const CandidateProfile = mongoose.model<ICandidateProfile>(
    'CandidateProfile',
    candidateProfileSchema,
);

// Re-export type for convenience
export type { ICandidateProfile } from '../types/candidate.types';
