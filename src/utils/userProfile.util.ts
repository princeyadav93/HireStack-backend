import { ICandidateProfile } from '../models/userProfile.model';

export const calculateProfileCompletion = (
    profile: ICandidateProfile,
): number => {
    let score = 0;
    const TOTAL = 100;

    const weights = {
        skills: 15,
        projects: 20,
        experience: 20,
        education: 15,
        resume: 15,
        social: 5,
        preferences: 10,
    };

    if (profile.skills?.length) score += weights.skills;

    if (profile.projects?.length) score += weights.projects;

    if (profile.experience?.length) score += weights.experience;

    if (profile.education?.length) score += weights.education;

    if (profile.resume?.url) score += weights.resume;

    if (profile.github || profile.linkedin) score += weights.social;

    if (profile.preferences && Object.keys(profile.preferences).length > 0) {
        score += weights.preferences;
    }

    return Math.min(score, TOTAL);
};

// ✅ Safe flatten: converts nested objects to dot-notation keys
export const flatten = (
    obj: Record<string, any>,
    prefix = '',
): Record<string, any> => {
    let result: Record<string, any> = {};

    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        // Skip undefined (VERY IMPORTANT)
        if (value === undefined) continue;

        // Handle arrays (DO NOT FLATTEN ARRAYS)
        if (Array.isArray(value)) {
            result[newKey] = value;
            continue;
        }

        // Handle nested objects
        if (
            typeof value === 'object' &&
            value !== null &&
            !(value instanceof Date)
        ) {
            const nested = flatten(value, newKey);
            result = { ...result, ...nested };
        } else {
            result[newKey] = value;
        }
    }

    return result;
};

// ✅ build mongo update query
export const buildUpdateQuery = (data: Record<string, any>) => {
    const setData: Record<string, any> = {};
    const unsetData: Record<string, any> = {};

    const flat = flatten(data);

    for (const key in flat) {
        if (flat[key] === null) {
            unsetData[key] = '';
        } else {
            setData[key] = flat[key];
        }
    }

    const updateQuery: any = {};

    if (Object.keys(setData).length) {
        updateQuery.$set = setData;
    }

    if (Object.keys(unsetData).length) {
        updateQuery.$unset = unsetData;
    }

    return updateQuery;
};
