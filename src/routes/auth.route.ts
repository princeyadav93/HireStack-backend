import { Router } from 'express';
import {
    forgotPassword,
    login,
    logout,
    refreshToken,
    resendVerificationEmail,
    resetPassword,
    verifyEmail,
} from '../controllers/auth.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { authLimiter, emailLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/logout', verifyJWT, logout);
// no verifyJWT — access token may be expired
router.post('/refresh-token', authLimiter, refreshToken);

// Redeeming a link. Unauthenticated by necessity — someone resetting a password
// cannot log in first, and someone verifying an email may be on a different
// device from the one they registered on. The token in the body is the only
// credential, which is why it is 256 bits of randomness.
router.post('/forgot-password', emailLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/verify-email', authLimiter, verifyEmail);

// Asking for another link, on the other hand, requires being logged in: taking
// an email address here instead would hand anyone a way to send mail to any
// address and to probe which ones are registered.
router.post(
    '/verify-email/resend',
    emailLimiter,
    verifyJWT,
    resendVerificationEmail,
);

export default router;
