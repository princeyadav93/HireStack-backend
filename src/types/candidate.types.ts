import { Document, Types } from 'mongoose';

/**
 * Job Type Enum
 */
export type JobType = 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP';

/**
 * Resume Type
 */
export interface Resume {
    fileName?: string;
    url?: string;
    uploadedAt?: Date;
}

/**
 * Project Type
 */
export interface Project {
    projectUrl?: string;
    projectName: string;
    projectDesc?: string;
    techStack: string[];
}

/**
 * Experience Type
 */
export interface Experience {
    company: string;
    role: string;
    startDate: Date;
    endDate?: Date;
}

/**
 * Education Type
 */
export interface Education {
    degree: string;
    college: string;
    year: number;
}

/**
 * Candidate Preferences Type
 */
export interface CandidatePreferences {
    desiredRole?: string;
    expectedSalary?: number | 0;
    locations?: string[];
    remote?: boolean;
    jobType?: JobType;
}

/**
 * ICandidateProfile - Candidate Profile Document Interface
 */
export interface ICandidateProfile extends Document {
    _id: Types.ObjectId;
    user: Types.ObjectId; // Reference to User model
    skills: string[];
    projects: Project[];
    resume: Resume;
    github?: string;
    linkedin?: string;
    preferences: CandidatePreferences;
    experience: Experience[];
    education: Education[];
    profileCompletion: number; // Percentage of profile completed
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Candidate Profile Document Type
 */
export type ICandidateProfileDocument = ICandidateProfile & Document;

/**
 * Candidate Profile Response Type (for API responses)
 */
export interface ICandidateProfileResponse {
    _id: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    skills: string[];
    projects: Project[];
    resume: Resume;
    github?: string;
    linkedin?: string;
    preferences: CandidatePreferences;
    experience: Experience[];
    education: Education[];
    profileCompletion: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Candidate Profile Create Input
 */
export interface CandidateProfileCreateInput {
    skills?: string[];
    github?: string;
    linkedin?: string;
    preferences?: CandidatePreferences;
}

/**
 * Candidate Profile Update Input
 */
export interface CandidateProfileUpdateInput {
    skills?: string[];
    projects?: Project[];
    resume?: Resume;
    github?: string;
    linkedin?: string;
    preferences?: CandidatePreferences;
    experience?: Experience[];
    education?: Education[];
}

/**
 * Candidate Profile Completion Stats
 */
export interface CandidateProfileStats {
    profileCompletion: number;
    skillsCount: number;
    projectsCount: number;
    hasResume: boolean;
    hasEducation: boolean;
    hasExperience: boolean;
}

/**
 * Candidate Search Filter Input
 */
export interface CandidateSearchFilterInput {
    skills?: string[];
    locations?: string[];
    remote?: boolean;
    jobType?: JobType;
    minSalary?: number;
    maxSalary?: number;
    desiredRole?: string;
    page?: number;
    limit?: number;
}
