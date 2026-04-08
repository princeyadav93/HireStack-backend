import express from 'express';
import { upload } from '../middleware/upload';
import { uploadResumeController } from '../controllers/userProfile.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { upsertProfileController } from '../controllers/userProfile.controller';

const router = express.Router();

router.post(
    '/resume',
    verifyJWT,
    upload.single('resume'),
    uploadResumeController,
);

router.post('/create', verifyJWT, upsertProfileController);
router.patch('/update', verifyJWT, upsertProfileController);

export default router;
