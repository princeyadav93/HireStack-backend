import { Router } from 'express';
import { login, logout, refreshToken } from '../controllers/auth.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/logout', verifyJWT, logout);
router.post('/refresh-token', refreshToken); // no verifyJWT — access token may be expired

export default router;
