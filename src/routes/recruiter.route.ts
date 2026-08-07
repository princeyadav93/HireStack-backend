import express from 'express';
import { registerRecruiterController } from '../controllers/recruiter.controller';
import { registerLimiter } from '../middleware/rateLimit.middleware';

const router = express.Router();

// Recruiter registration only
// Login/Logout handled by global auth routes
router.post('/register', registerLimiter, registerRecruiterController);

export default router;
