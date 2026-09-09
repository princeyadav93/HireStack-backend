import { Types } from 'mongoose';
import { Application } from '../models/application.model';
import { Job } from '../models/job.model';
import { ApplicationStatus, JobStatus } from '../constants/enums';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants';

/**
 * Fold `[{ _id: 'PUBLISHED', count: 3 }]` into a complete map of every status.
 *
 * A `$group` only emits buckets that matched something, so a company with no
 * rejections gets no `REJECTED` key at all. Returning the gaps as zeroes means
 * the client never has to defend against `undefined` on a number, and — more to
 * the point — "nobody has been rejected yet" stays distinguishable from "this
 * field is missing", which is the bug an absent key eventually causes.
 */
const tally = <T extends string>(
    statuses: readonly T[],
    rows: Array<{ _id: T | null; count: number }>,
): Record<T, number> & { total: number } => {
    const counts = Object.fromEntries(
        statuses.map((status) => [status, 0]),
    ) as Record<T, number>;

    let total = 0;

    for (const row of rows) {
        if (row._id !== null && row._id in counts) {
            counts[row._id] = row.count;
        }

        // Counted even if the status is one this build does not know about, so
        // the total stays a true total across an enum change.
        total += row.count;
    }

    return { ...counts, total };
};

/**
 * The opening screen of a hiring product: how many jobs sit in each state, and
 * how many applications sit in each stage.
 *
 * Scope is the caller's own company, taken from their membership record.
 */
export const getCompanyDashboardService = async (companyId: string) => {
    if (!Types.ObjectId.isValid(companyId)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid company ID');
    }

    const scope = new Types.ObjectId(companyId);

    // Two collections means two pipelines, but neither depends on the other, so
    // they cost one round trip rather than two.
    const [jobRows, applicationRows] = await Promise.all([
        Job.aggregate<{ _id: JobStatus | null; count: number }>([
            // Archived jobs are soft-deleted so their applications stay
            // readable; counting them would report work the company can no
            // longer see on its own board.
            { $match: { companyId: scope, isArchived: false } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Application.aggregate<{ _id: ApplicationStatus | null; count: number }>(
            [
                { $match: { companyId: scope } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
        ),
    ]);

    return {
        jobs: tally(Object.values(JobStatus), jobRows),
        applications: tally(Object.values(ApplicationStatus), applicationRows),
    };
};
