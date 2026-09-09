// src/routes/companymember.route.ts
import express from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import {
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
} from '../middleware/companyAuth.middleware';
import {
    getCompanyMembersController,
    blockMemberController,
    unblockMemberController,
    getCompanyRecruitersController,
} from '../controllers/companyMembers.controller';
import { getMyCompanyController } from '../controllers/companyOwner.controller';
import { listCompanyApplicationsController } from '../controllers/application.controller';
import { getCompanyDashboardController } from '../controllers/companyDashboard.controller';

const router = express.Router();

// GET /company/me
// The caller's own company. It lives in this router rather than next to the
// other company routes for the same reason /members does: companyOwnerRouter
// owns `GET /:companyId`, which matches any single segment, and this router is
// mounted first. Declared beside its sibling `GET /:companyId` it would only
// ever be reached as a company literally named "me".
router.get('/me', verifyJWT, verifyCompanyMember, getMyCompanyController);

// GET /company/members
// Any ACTIVE member can view company members
router.get(
    '/members',
    verifyJWT,
    verifyCompanyMember,
    getCompanyMembersController,
);

router.get(
    '/members/recruiter',
    verifyJWT,
    verifyCompanyMember,
    getCompanyRecruitersController,
);

// GET /company/applications
// Every application to the company, across every job, newest first.
// Optional ?status= narrows it to one stage of the pipeline.
//
// GET /company/dashboard
// Job counts by status and application counts by stage, in one call.
//
// Both sit in this router for the same reason /me and /members do:
// companyOwnerRouter owns `GET /:companyId`, which swallows any single
// segment, and it is mounted second.
router.get(
    '/applications',
    verifyJWT,
    verifyCompanyMember,
    listCompanyApplicationsController,
);

router.get(
    '/dashboard',
    verifyJWT,
    verifyCompanyMember,
    getCompanyDashboardController,
);

// verifyCompanyOwnerOrAdmin reads req.companyMember, which only
// verifyCompanyMember sets — without it these routes always returned 403.
router.patch(
    '/block/member/:memberId',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    blockMemberController,
);
router.patch(
    '/unblock/member/:memberId',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    unblockMemberController,
);
export default router;
