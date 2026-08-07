import express from 'express';
import { upload } from '../middleware/upload';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyRecruiter } from '../middleware/roleVerification.middleware';
import {
    uploadProfileImageController,
    updatePersonalInfo,
    updateSocialLinks,
    getProfile,
} from '../controllers/recruiterProfile.controller';

const router = express.Router();

// All routes protected - require JWT and recruiter role
router.use(verifyJWT, verifyRecruiter);

/**
 * GET /recruiter/profile
 * Get recruiter's own profile
 */
router.get('/', getProfile);

/**
 * PATCH /recruiter/profile/image
 * Upload or update recruiter profile image
 */
router.patch(
    '/avatar',
    upload.single('profileImage'),
    uploadProfileImageController,
);

/**
 * PATCH /recruiter/profile/personal-info
 * Update personal info (title, department, bio, phone)
 */
router.patch('/personal-info', updatePersonalInfo);

/**
 * PATCH /recruiter/profile/social-links
 * Update social links (linkedin, twitter, website)
 */
router.patch('/social-links', updateSocialLinks);

export default router;
