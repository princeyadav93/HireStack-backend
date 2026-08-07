import { PAGINATION } from '../constants';

/**
 * Turn raw `page` / `limit` query params into safe numbers.
 *
 * Guards against `?limit=999999999` (pulls the entire collection in one query)
 * and `?page=-5` (negative skip, which Mongo rejects with a 500).
 */
export const getPagination = (query: {
    page?: unknown;
    limit?: unknown;
}): { page: number; limit: number } => {
    const parsedPage = parseInt(String(query.page ?? ''), 10);
    const parsedLimit = parseInt(String(query.limit ?? ''), 10);

    const page =
        Number.isFinite(parsedPage) && parsedPage > 0
            ? parsedPage
            : PAGINATION.DEFAULT_PAGE;

    const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, PAGINATION.MAX_LIMIT)
            : PAGINATION.DEFAULT_LIMIT;

    return { page, limit };
};
