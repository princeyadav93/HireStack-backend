import express from 'express';
import { registerRecruiterController } from '../controllers/recruiter.controller';

const router = express.Router();

// Recruiter registration only
// Login/Logout handled by global auth routes
router.post('/register', registerRecruiterController);

export default router;
