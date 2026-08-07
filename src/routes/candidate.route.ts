import express from 'express';
import {
    getCandidateController,
    registerCandidate,
} from '../controllers/candidate.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { registerLimiter } from '../middleware/rateLimit.middleware';

const router = express.Router();

// Candidate registration only
// Login/Logout handled by global auth routes
router.get('/', verifyJWT, getCandidateController);

router.post('/register', registerLimiter, registerCandidate);

export default router;
