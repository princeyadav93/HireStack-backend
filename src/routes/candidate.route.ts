import express from 'express';
import {
    registerCandidate,
    loginCandidate,
    logoutCandidate,
    // Backward compatibility
    registerUser,
    loginUser,
    logoutUser,
} from '../controllers/candidate.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = express.Router();

// Candidate endpoints
router.post('/register', registerCandidate);
router.post('/login', loginCandidate);
router.post('/logout', verifyJWT, logoutCandidate);

export default router;
