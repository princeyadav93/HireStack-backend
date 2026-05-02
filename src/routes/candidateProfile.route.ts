import express from 'express';
import { upload } from '../middleware/upload';
import {
    uploadResumeController,
    uploadProfileImageController,
    getCandidateProfileController,
} from '../controllers/candidateProfile.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', verifyJWT, getCandidateProfileController);

router.patch(
    '/resume',
    verifyJWT,
    upload.single('resume'),
    uploadResumeController,
);

router.patch(
    '/profile-image',
    verifyJWT,
    upload.single('profileImage'),
    uploadProfileImageController,
);

import {
    updateBasicProfile,
    updateProjects,
    updateExperience,
    updateEducation,
    updatePreferences,
} from '../controllers/candidateProfile.controller';

// All routes protected

// PATCH routes
router.patch('/basic', verifyJWT, updateBasicProfile);
router.patch('/projects', verifyJWT, updateProjects);
router.patch('/experience', verifyJWT, updateExperience);
router.patch('/education', verifyJWT, updateEducation);
router.patch('/preferences', verifyJWT, updatePreferences);

export default router;
