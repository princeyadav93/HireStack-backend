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
 * A company arrives here either lean or as a hydrated document, depending on
 * which service produced it — and spreading a hydrated document copies
 * Mongoose's internal `$__` cache instead of the fields.
 *
 * That was not a cosmetic problem. When the document was loaded inside a
 * transaction, `$__` holds the session, the session reaches the MongoClient,
 * and `res.json` dies on the circular structure — so approve, suspend and
 * unsuspend each answered 500 after committing their write successfully.
 * `toObject()` first makes both shapes the same plain object, which is also the
 * only shape the redactions below can affect: assigning to a spread of a
 * hydrated document writes a property nothing reads.
 */
const toPlainCompany = (company: ICompany): ICompany =>
    typeof company.toObject === 'function'
        ? (company.toObject() as ICompany)
        : ({ ...company } as ICompany);

/**
 * Filter sensitive fields based on role
 */
const filterSensitiveData = (company: ICompany, userRole: string): ICompany => {
    const filtered = toPlainCompany(company);

    // Only admin sees suspendedBy and internalDescription
    if (userRole !== 'admin') {
        if (filtered.suspensionDetails) {
            filtered.suspensionDetails = {
                ...filtered.suspensionDetails,
                suspendedBy: undefined,
                internalDescription: undefined,
            };
        }

        // Which admin approved, rejected or archived a company is platform
        // bookkeeping, and naming a specific reviewer to the company they ruled
        // on invites them to be lobbied. `rejectionReason` deliberately stays:
        // it is the one answer an owner has to "what was wrong with our
        // application?", and withholding it is why the field was worth adding.
        filtered.approvedBy = undefined;
        filtered.rejectedBy = undefined;
        filtered.archivedBy = undefined;
    }

    return filtered;
};
