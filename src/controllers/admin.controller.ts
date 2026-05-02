import { Request, Response, NextFunction } from 'express';
import { registerAdminService } from '../services/admin.service';
import { COOKIE_OPTIONS, HTTP_STATUS } from '../constants';
import { RegisterDTO } from '../dtos/user.dto';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';

/**
 * Admin registration controller
 */
export const registerAdmin = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const parsed = RegisterDTO.parse(req.body);

        const result = await registerAdminService(parsed);

        res.cookie('token', result.token, COOKIE_OPTIONS);

        res.status(HTTP_STATUS.CREATED).json(
            new ApiResponse(
                HTTP_STATUS.CREATED,
                result,
                'Admin registered successfully',
            ),
        );
    },
);
