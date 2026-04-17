import express from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyRecruiter } from '../middleware/roleVerification.middleware';
import { createCompanyController } from '../controllers/company.controller';

const router = express.Router();

/**
 * POST /company
 * Create a new company
 * - Requires authentication (verifyJWT)
 * - Only recruiters can create companies (verifyRecruiter)
 * - Each recruiter can only create ONE company
 */
router.post('/create', verifyJWT, verifyRecruiter, createCompanyController);

export default router;
