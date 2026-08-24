import { describe, expect, it } from 'vitest';
import { api, login } from '../helpers/api';
import { useTestDatabase } from '../helpers/db';
import { createCompany, createUser } from '../helpers/factories';

/**
 * The platform admin's two company listings.
 *
 * Both used to return every matching row with no pagination, and the audit
 * view interpolated the caller's `searchTerm` straight into a `$regex` — the
 * one search path in the codebase that skipped `escapeRegex`. A term like
 * `(a+)+$` is a catastrophic-backtracking pattern, so a single request could
 * pin the event loop.
 */

useTestDatabase();

const adminCookies = async () => {
    const admin = await createUser({ role: 'admin' });
    return login(admin.email);
};

const seedCompanies = async (names: string[], status: 'pending' | 'approved') => {
    const owner = await createUser({ role: 'recruiter' });

    for (const name of names) {
        await createCompany({ createdBy: owner._id, name, status });
    }
};

describe('GET /admin/companies/pending', () => {
    it('paginates rather than returning the whole queue', async () => {
        const cookies = await adminCookies();
        await seedCompanies(
            Array.from({ length: 15 }, (_, i) => `Pending Co ${i}`),
            'pending',
        );

        const res = await api()
            .get('/admin/companies/pending?limit=10')
            .set('Cookie', cookies);

        expect(res.status).toBe(200);
        expect(res.body.data.companies).toHaveLength(10);
        expect(res.body.data.pagination).toMatchObject({
            page: 1,
            limit: 10,
            total: 15,
            pages: 2,
        });
    });

    it('clamps limit to the pagination ceiling', async () => {
        const cookies = await adminCookies();
        await seedCompanies(['Only One'], 'pending');

        // An unbounded limit is a free full scan of the collection.
        const res = await api()
            .get('/admin/companies/pending?limit=999999')
            .set('Cookie', cookies);

        expect(res.body.data.pagination.limit).toBe(100);
    });
});

describe('GET /admin/companies', () => {
    it('paginates the audit view', async () => {
        const cookies = await adminCookies();
        await seedCompanies(
            Array.from({ length: 12 }, (_, i) => `Audit Co ${i}`),
            'approved',
        );

        const res = await api()
            .get('/admin/companies?limit=5&page=2')
            .set('Cookie', cookies);

        expect(res.status).toBe(200);
        expect(res.body.data.companies).toHaveLength(5);
        expect(res.body.data.pagination).toMatchObject({
            page: 2,
            limit: 5,
            total: 12,
            pages: 3,
        });
    });

    it('treats regex metacharacters in searchTerm as literal text', async () => {
        const cookies = await adminCookies();

        // Both names contain "Pvt"; only one contains the parentheses. That is
        // what makes this a real check: unescaped, `(Pvt)` is a capture group
        // and matches both. Escaped, it is six literal characters and matches
        // only the one that actually has them.
        await seedCompanies(['Acme (Pvt) Ltd', 'Acme Pvt Ltd'], 'approved');

        const res = await api()
            .get(`/admin/companies?searchTerm=${encodeURIComponent('(Pvt)')}`)
            .set('Cookie', cookies);

        expect(res.status).toBe(200);
        expect(res.body.data.companies).toHaveLength(1);
        expect(res.body.data.companies[0].name).toBe('Acme (Pvt) Ltd');
    });

    it('does not hang on a catastrophic-backtracking pattern', async () => {
        const cookies = await adminCookies();
        await seedCompanies([`${'a'.repeat(40)}!`], 'approved');

        // Escaped, this is a search for the literal string "(a+)+$" — it
        // matches nothing and returns immediately. Unescaped against the seeded
        // name it is the classic ReDoS trigger.
        const started = Date.now();
        const res = await api()
            .get(`/admin/companies?searchTerm=${encodeURIComponent('(a+)+$')}`)
            .set('Cookie', cookies);

        expect(res.status).toBe(200);
        expect(res.body.data.companies).toHaveLength(0);
        expect(Date.now() - started).toBeLessThan(2000);
    });

    it('is closed to non-admins', async () => {
        const recruiter = await createUser({ role: 'recruiter' });
        const cookies = await login(recruiter.email);

        const res = await api().get('/admin/companies').set('Cookie', cookies);

        expect(res.status).toBe(403);
    });
});
