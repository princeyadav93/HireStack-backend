import express from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { verifyRecruiter } from '../middleware/roleVerification.middleware';
import {
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    verifyCompanyOwner,
    verifyBillingAdmin,
} from '../middleware/companyAuth.middleware';
import {
    createCompanyController,
    joinCompanyController,
    inviteRecruiterController,
    approveMemberController,
    rejectMemberController,
    removeMemberController,
    changeMemberRoleController,
    getCompanyMembersController,
    delegateBillingAdminController,
} from '../controllers/company.controller';

const router = express.Router();

/**
 * POST /company
 * Create a new company
 * - Requires authentication (verifyJWT)
 * - Only recruiters can create companies (verifyRecruiter)
 * - Each recruiter can only create ONE company
 */
router.post('/create', verifyJWT, verifyRecruiter, createCompanyController);

/**
 * POST /company/join/:companyId
 * Join an existing company
 * - Requires authentication (verifyJWT)
 * - Only recruiters can join (verifyRecruiter)
 * - Company must be approved status
 */
router.post(
    '/join/:companyId',
    verifyJWT,
    verifyRecruiter,
    joinCompanyController,
);

/**
 * POST /company/:companyId/invite
 * Invite a recruiter to company
 * - Requires authentication
 * - Only OWNER or ADMIN can invite
 */
router.post(
    '/:companyId/invite',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    inviteRecruiterController,
);

/**
 * POST /company/:companyId/members/approve
 * Approve pending membership
 * - Only OWNER or ADMIN can approve
 */
router.post(
    '/:companyId/members/approve',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    approveMemberController,
);

/**
 * POST /company/:companyId/members/reject
 * Reject pending membership
 * - Only OWNER or ADMIN can reject
 */
router.post(
    '/:companyId/members/reject',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    rejectMemberController,
);

/**
 * DELETE /company/:companyId/members/remove
 * Remove member from company
 * - Only OWNER or ADMIN can remove
 */
router.post(
    '/:companyId/members/remove',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwnerOrAdmin,
    removeMemberController,
);

/**
 * PUT /company/:companyId/members/role
 * Change member role
 * - Only OWNER can change roles
 */
router.put(
    '/:companyId/members/role',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwner,
    changeMemberRoleController,
);

/**
 * GET /company/:companyId/members
 * Get all active members of company
 * - Any ACTIVE member can view
 */
router.get(
    '/:companyId/members',
    verifyJWT,
    verifyCompanyMember,
    getCompanyMembersController,
);

/**
 * POST /company/:companyId/billing-admin
 * Delegate billing admin permissions
 * - Only OWNER can delegate
 */
router.post(
    '/:companyId/billing-admin',
    verifyJWT,
    verifyCompanyMember,
    verifyCompanyOwner,
    delegateBillingAdminController,
);

export default router;
