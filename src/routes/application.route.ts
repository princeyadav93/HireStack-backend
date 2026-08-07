import express from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyCandidate } from '../middleware/roleVerification.middleware';
import { verifyCompanyMember } from '../middleware/companyAuth.middleware';
import {
    listMyApplicationsController,
    getApplicationController,
    updateApplicationStatusController,
} from '../controllers/application.controller';

const router = express.Router();

// GET /applications/me — a candidate's own applications.
// Registered before `/:applicationId` so it is not treated as an ID.
router.get('/me', verifyJWT, verifyCandidate, listMyApplicationsController);

// PATCH /applications/:applicationId/status — move through the pipeline.
// Company-scoped: the service rejects applications belonging to another tenant.
router.patch(
    '/:applicationId/status',
    verifyJWT,
    verifyCompanyMember,
    updateApplicationStatusController,
);

// GET /applications/:applicationId — readable by the candidate who submitted it
// or by an active member of the owning company. Authorisation is decided in the
// service because it depends on which of the two the caller is.
router.get('/:applicationId', verifyJWT, getApplicationController);

export default router;
