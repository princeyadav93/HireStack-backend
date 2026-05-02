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

const router = express.Router();

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

router.patch(
    '/block/member/:memberId',
    verifyJWT,
    verifyCompanyOwnerOrAdmin,
    blockMemberController,
);
router.patch(
    '/unblock/member/:memberId',
    verifyJWT,
    verifyCompanyOwnerOrAdmin,
    unblockMemberController,
);
export default router;
