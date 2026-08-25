import express from 'express';
import { registerCandidate } from '../controllers/candidate.controller';
import { registerLimiter } from '../middleware/rateLimit.middleware';

const router = express.Router();

// Registration only. Login and logout are global auth routes, and "who am I"
// is GET /auth/me — this router used to answer that too, from a handler that
// just echoed req.user and worked for every role despite the candidate path.
router.post('/register', registerLimiter, registerCandidate);

export default router;
