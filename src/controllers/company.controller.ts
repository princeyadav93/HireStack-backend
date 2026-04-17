import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CreateCompanyDTO } from '../dtos/company.dto';
import { createCompanyService } from '../services/company.service';

/**
 * Create a new company
 * - Only recruiters can create companies
 * - Each recruiter can only create ONE company
 * - Automatically creates recruiter profile as owner with isVerified=false
 */
export const createCompanyController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
            return;
        }

        const parsed = CreateCompanyDTO.parse(req.body);
        const company = await createCompanyService(parsed, userId);

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: company,
        });
    },
);
