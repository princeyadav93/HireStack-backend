import express from 'express';
import { upload } from '../middleware/upload';
import { uploadResumeController } from '../controllers/userProfile.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = express.Router();

router.patch(
    '/resume',
    verifyJWT,
    upload.single('resume'),
    uploadResumeController,
);

import {
    updateBasicProfile,
    updateProjects,
    updateExperience,
    updateEducation,
    updatePreferences,
} from '../controllers/userProfile.controller';

// All routes protected

// PATCH routes
router.patch('/basic', verifyJWT, updateBasicProfile);
router.patch('/projects', verifyJWT, updateProjects);
router.patch('/experience', verifyJWT, updateExperience);
router.patch('/education', verifyJWT, updateEducation);
router.patch('/preferences', verifyJWT, updatePreferences);

export default router;
