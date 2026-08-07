import { Router } from 'express';
import { login, logout, refreshToken } from '../controllers/auth.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/logout', verifyJWT, logout);
// no verifyJWT — access token may be expired
router.post('/refresh-token', authLimiter, refreshToken);

export default router;
