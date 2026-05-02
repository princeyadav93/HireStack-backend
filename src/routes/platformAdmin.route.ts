import express from 'express';
import { registerAdmin } from '../controllers/admin.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyAdmin } from '../middleware/adminAuth.middleware';
import {
    getPendingCompaniesController,
    approveCompanyController,
    rejectCompanyController,
    suspendCompanyController,
    unsuspendCompanyController,
    getCompaniesController,
    getAllCompaniesController,
    getAllUsersController,
    deleteCompanyController,
} from '../controllers/platformAdmin.controller';

const router = express.Router();

// Admin registration (for testing)
router.post('/register', registerAdmin);

// Company verification endpoints (admin only)
router.get(
    '/companies/pending',
    verifyJWT,
    verifyAdmin,
    getPendingCompaniesController,
);
router.post(
    '/companies/approve/:companyId',
    verifyJWT,
    verifyAdmin,
    approveCompanyController,
);
router.post(
    '/companies/:companyId/reject',
    verifyJWT,
    verifyAdmin,
    rejectCompanyController,
);

// Company suspension endpoints (admin only)
router.post(
    '/companies/:companyId/suspend',
    verifyJWT,
    verifyAdmin,
    suspendCompanyController,
);
router.post(
    '/companies/:companyId/unsuspend',
    verifyJWT,
    verifyAdmin,
    unsuspendCompanyController,
);

// Company audit view (admin only)
router.get('/companies', verifyJWT, verifyAdmin, getCompaniesController);

/**
 * Platform Admin Routes (separate namespace)
 * GET /admin/platform/companies - Get all companies paginated
 * GET /admin/platform/users - Get all users paginated
 * DELETE /admin/platform/companies/:companyId - Soft delete company
 */

/**
 * GET /admin/platform/companies
 * Get all companies (paginated, filter by status)
 * Query: page, limit, status, isSuspended
 */
router.get(
    '/platform/companies',
    verifyJWT,
    verifyAdmin,
    getAllCompaniesController,
);

/**
 * GET /admin/platform/users
 * Get all users (paginated, filter by role)
 * Query: page, limit, role
 */
router.get('/platform/users', verifyJWT, verifyAdmin, getAllUsersController);

/**
 * DELETE /admin/platform/companies/:companyId
 * Delete company (soft delete, isArchived: true)
 */
router.delete(
    '/platform/companies/:companyId',
    verifyJWT,
    verifyAdmin,
    deleteCompanyController,
);

export default router;
