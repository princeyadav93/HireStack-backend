// src/routes/companyowner.routes.ts
import express from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyRecruiter } from '../middleware/roleVerification.middleware';
import {
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    verifyCompanyOwner,
} from '../middleware/companyAuth.middleware';
import {
    createCompanyController,
    createAdminController,
    createRecruiterController,
    deleteAdminController,
    deleteRecruiterController,
    getCompanyController,
    updateCompanyController,
    uploadCompanyLogoController,
} from '../controllers/companyOwner.controller';
import { upload } from '../middleware/upload';

const router = express.Router();

// POST /company/create
// Global recruiter creates a company → becomes OWNER
router.post('/create', verifyJWT, verifyRecruiter, createCompanyController);

// POST /company/create-admin
// OWNER creates an admin for their company
router.post(
    '/create-admin',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwner,
    createAdminController,
);

// POST /company/create-recruiter
// OWNER or ADMIN creates a recruiter for their company
router.post(
    '/create-recruiter',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    createRecruiterController,
);

// DELETE /company/admins/:adminId
// OWNER deletes an admin from their company
router.delete(
    '/admins/:adminId',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwner,
    deleteAdminController,
);

// DELETE /company/recruiters/:recruiterId
// OWNER or ADMIN deletes a recruiter from their company
router.delete(
    '/recruiters/:recruiterId',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    deleteRecruiterController,
);

// PATCH /company/:companyId/logo
// OWNER only — same authority as editing any other company detail.
// Registered before `/:companyId` for readability; the two cannot collide, as
// a single-segment pattern never matches a two-segment path.
router.patch(
    '/:companyId/logo',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwner,
    upload.single('logo'),
    uploadCompanyLogoController,
);

// GET /company/:companyId
// Any authenticated user can view company details
router.get('/:companyId', verifyJWT, getCompanyController);

// PATCH /company/:companyId
// OWNER only can update company details
router.patch(
    '/:companyId',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwner,
    updateCompanyController,
);

export default router;
