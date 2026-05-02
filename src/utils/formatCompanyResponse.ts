import { ICompany } from '../types/company.types';

/**
 * Format company data based on user role
 * Hides sensitive admin data from non-admin users
 */
export const formatCompanyForRole = (
    company: ICompany | ICompany[] | null,
    userRole: string,
): ICompany | ICompany[] | null => {
    if (!company) return null;

    // Handle array of companies
    if (Array.isArray(company)) {
        return company.map((c) => filterSensitiveData(c, userRole));
    }

    // Handle single company
    return filterSensitiveData(company, userRole);
};

/**
 * Filter sensitive fields based on role
 */
const filterSensitiveData = (company: ICompany, userRole: string): ICompany => {
    const filtered = { ...company } as ICompany;

    // Only admin sees suspendedBy and internalDescription
    if (userRole !== 'admin') {
        if (filtered.suspensionDetails) {
            filtered.suspensionDetails = {
                ...filtered.suspensionDetails,
                suspendedBy: undefined,
                internalDescription: undefined,
            };
        }
    }

    return filtered;
};
