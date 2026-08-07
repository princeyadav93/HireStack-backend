import { Request, Response, NextFunction } from 'express';
import { registerAdminService } from '../services/admin.service';
import { HTTP_STATUS } from '../constants';
import { RegisterDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

/**
 * Create a platform admin. Admin-only; see platformAdmin.route.ts.
 *
 * No session is issued here: this creates an account for someone else, so
 * setting a cookie would swap the calling admin's session for the new one.
 */
export const registerAdmin = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = RegisterDTO.parse(req.body);

        const user = await registerAdminService(parsed);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                { user },
                'Admin created successfully',
            ),
        );
    },
);
