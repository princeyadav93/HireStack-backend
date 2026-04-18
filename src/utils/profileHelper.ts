import { ClientSession } from 'mongoose';
import { CandidateProfile } from '../models/candidateProfile.model';
import { RecruiterProfile } from '../models/recruiterProfile.model';
import { IUser } from '../models/user.model';

/**
 * Creates a profile based on user role
 * Used in registration flow for both candidate and recruiter
 */
export const createProfileByRole = async (
    user: IUser | string,
    session?: ClientSession,
) => {
    const userId = typeof user === 'string' ? user : user._id.toString();
    const role = typeof user === 'string' ? null : user.role;

    if (!role) {
        throw new Error('Cannot determine user role');
    }

    if (role === 'candidate') {
        return await createCandidateProfile(userId, session);
    } else if (role === 'recruiter') {
        return await createRecruiterProfile(userId, session);
    } else {
        throw new Error(`Unsupported role: ${role}`);
    }
};

/**
 * Creates candidate profile for new user
 */
export const createCandidateProfile = async (
    userId: string,
    session?: ClientSession,
) => {
    return await CandidateProfile.create(
        [
            {
                user: userId,
                profileCompletion: 0,
            },
        ],
        { session },
    ).then((docs) => docs[0]);
};

/**
 * Creates recruiter profile for new user
 */
export const createRecruiterProfile = async (
    userId: string,
    session?: ClientSession,
) => {
    return await RecruiterProfile.create(
        [
            {
                user: userId,
            },
        ],
        { session },
    ).then((docs) => docs[0]);
};
