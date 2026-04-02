import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProfile extends Document {
    user: Types.ObjectId;
    skills: string[];
    projects: {
        projectUrl: string;
        projectName: string;
        projectDesc: string;
        techStack: string[];
    }[];
    resumeUrl?: string;
    github?: string;
    linkedin?: string;
    preferences: {
        desiredRole?: string;
        expectedSalary?: number;
        locations?: string[];
        remote?: boolean;
        jobType?: 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP';
    };
    experience: {
        company: string;
        role: string;
        years: number;
        startDate: Date;
        endDate?: Date;
    }[];
    education: {
        degree: string;
        college: string;
        year: number;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const userProfileSchema = new Schema<IProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // one profile per user
        },

        skills: [
            {
                type: String,
                trim: true,
            },
        ],

        projects: [
            {
                projectUrl: { type: String, trim: true },
                projectName: { type: String, required: true, trim: true },
                projectDesc: { type: String, trim: true },
                techStack: [{ type: String }],
            },
        ],

        resumeUrl: {
            type: String,
        },

        github: {
            type: String,
            trim: true,
        },

        linkedin: {
            type: String,
            trim: true,
        },

        preferences: {
            desiredRole: { type: String },
            expectedSalary: { type: Number },
            locations: [{ type: String }],
            remote: { type: Boolean, default: false },
            jobType: {
                type: String,
                enum: ['FULL_TIME', 'PART_TIME', 'INTERNSHIP'],
            },
        },

        experience: [
            {
                company: { type: String, required: true },
                role: { type: String, required: true },
                years: { type: Number, min: 0 },
                startDate: { type: Date },
                endDate: { type: Date },
            },
        ],

        education: [
            {
                degree: { type: String },
                college: { type: String },
                year: { type: Number },
            },
        ],
    },
    {
        timestamps: true,
    },
);

export const UserProfile = mongoose.model<IProfile>(
    'UserProfile',
    userProfileSchema,
);
