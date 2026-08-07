import express from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyCandidate } from '../middleware/roleVerification.middleware';
import {
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
} from '../middleware/companyAuth.middleware';
import {
    createJobController,
    updateJobController,
    publishJobController,
    closeJobController,
    archiveJobController,
    listCompanyJobsController,
    getCompanyJobController,
    listPublicJobsController,
    getPublicJobController,
} from '../controllers/job.controller';
import {
    applyToJobController,
    listJobApplicationsController,
} from '../controllers/application.controller';

const router = express.Router();

/**
 * ORDER MATTERS: literal paths must be registered before `/:jobId`, which
 * matches any single segment and would otherwise swallow them.
 */

// GET /jobs/manage — the company's own board, drafts included
router.get(
    '/manage',
    verifyJWT,
    verifyCompanyMember,
    listCompanyJobsController,
);

// GET /jobs/manage/:jobId — company-side detail, drafts included
router.get(
    '/manage/:jobId',
    verifyJWT,
    verifyCompanyMember,
    getCompanyJobController,
);

// ─── Public job board (no authentication) ────────────────────────────────

// GET /jobs — published jobs from approved companies
router.get('/', listPublicJobsController);

// ─── Company-side writes ─────────────────────────────────────────────────

// POST /jobs — any active member of an approved-or-pending company
router.post('/', verifyJWT, verifyCompanyMember, createJobController);

router.patch('/:jobId', verifyJWT, verifyCompanyMember, updateJobController);

router.post(
    '/:jobId/publish',
    verifyJWT,
    verifyCompanyMember,
    publishJobController,
);

router.post('/:jobId/close', verifyJWT, verifyCompanyMember, closeJobController);

// Removing a job is destructive, so it is limited to OWNER/ADMIN.
router.delete(
    '/:jobId',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    archiveJobController,
);

// ─── Applications against a job ──────────────────────────────────────────

// POST /jobs/:jobId/apply — candidates only
router.post('/:jobId/apply', verifyJWT, verifyCandidate, applyToJobController);

// GET /jobs/:jobId/applications — the hiring pipeline, company-scoped
router.get(
    '/:jobId/applications',
    verifyJWT,
    verifyCompanyMember,
    listJobApplicationsController,
);

// GET /jobs/:jobId — public detail. Registered last so the literal routes above
// take precedence.
router.get('/:jobId', getPublicJobController);

export default router;
