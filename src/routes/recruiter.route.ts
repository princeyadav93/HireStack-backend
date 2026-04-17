import express from 'express';
import {
    registerRecruiterController,
    loginRecruiter,
    logoutRecruiter,
} from '../controllers/recruiter.controller';

const router = express.Router();

router.post('/register', registerRecruiterController);
router.post('/login', loginRecruiter);
router.post('/logout', logoutRecruiter);
export default router;
