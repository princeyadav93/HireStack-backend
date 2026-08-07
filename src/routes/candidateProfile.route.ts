import express from 'express';
import { upload } from '../middleware/upload';
import {
    uploadResumeController,
    uploadProfileImageController,
    getCandidateProfileController,
    updateBasicProfile,
    updateProjects,
    updateExperience,
    updateEducation,
    updatePreferences,
} from '../controllers/candidateProfile.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyCandidate } from '../middleware/roleVerification.middleware';

const router = express.Router();

// Every route here operates on the caller's own candidate profile, so the role
// check belongs on the whole router — mirroring recruiterProfile.route.ts.
router.use(verifyJWT, verifyCandidate);

router.get('/', getCandidateProfileController);

router.patch('/resume', upload.single('resume'), uploadResumeController);

router.patch(
    '/profile-image',
    upload.single('profileImage'),
    uploadProfileImageController,
);

// PATCH routes
router.patch('/basic', updateBasicProfile);
router.patch('/projects', updateProjects);
router.patch('/experience', updateExperience);
router.patch('/education', updateEducation);
router.patch('/preferences', updatePreferences);

export default router;
