import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api';
import { openApiDocument } from '../../src/docs/openapi';

import authRoutes from '../../src/routes/auth.route';
import candidateRouter from '../../src/routes/candidate.route';
import candidateProfileRouter from '../../src/routes/candidateProfile.route';
import recruiterRouter from '../../src/routes/recruiter.route';
import recruiterProfileRouter from '../../src/routes/recruiterProfile.route';
import adminRouter from '../../src/routes/platformAdmin.route';
import companyOwnerRouter from '../../src/routes/companyOwner.route';
import companyMemberRouter from '../../src/routes/companyMember.route';
import jobRouter from '../../src/routes/job.route';
import applicationRouter from '../../src/routes/application.route';

/**
 * The spec is only worth having if it cannot drift.
 *
 * Request schemas are generated from the DTOs, so those track themselves. The
 * gap generation cannot close is a route added without a matching entry in the
 * document — which is exactly how the old collection ended up describing
 * endpoints that no longer existed. This test walks the routers that app.ts
 * actually mounts and compares them against the spec, so adding an endpoint
 * without documenting it fails CI.
 *
 * No database needed: this reads route tables, not data.
 */

// Mirrors the mounting in src/app.ts.
const MOUNTS: Array<[string, { stack?: any[] }]> = [
    ['/auth', authRoutes],
    ['/candidate', candidateRouter],
    ['/candidate/profile', candidateProfileRouter],
    ['/recruiter', recruiterRouter],
    ['/recruiter/profile', recruiterProfileRouter],
    ['/admin', adminRouter],
    ['/company', companyMemberRouter],
    ['/company', companyOwnerRouter],
    ['/jobs', jobRouter],
    ['/applications', applicationRouter],
];

/** `/jobs/:jobId` in Express is `/jobs/{jobId}` in OpenAPI. */
const toOpenApiPath = (path: string) =>
    path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const registeredOperations = (): string[] => {
    const found: string[] = [];

    for (const [prefix, router] of MOUNTS) {
        for (const layer of router.stack ?? []) {
            if (!layer.route) continue;

            const path = layer.route.path === '/' ? '' : layer.route.path;

            for (const [method, enabled] of Object.entries(
                layer.route.methods ?? {},
            )) {
                if (!enabled) continue;
                found.push(
                    `${method.toUpperCase()} ${toOpenApiPath(`${prefix}${path}`)}`,
                );
            }
        }
    }

    return found.sort();
};

const documentedOperations = (): string[] =>
    Object.entries(openApiDocument.paths)
        .flatMap(([path, item]) =>
            Object.keys(item).map(
                (method) => `${method.toUpperCase()} ${path}`,
            ),
        )
        // The health check lives in app.ts, not in a router, so it has no
        // counterpart in the walk above.
        .filter((op) => op !== 'GET /')
        .sort();

describe('OpenAPI document', () => {
    it('documents every route the app mounts', () => {
        const undocumented = registeredOperations().filter(
            (op) => !documentedOperations().includes(op),
        );

        expect(undocumented).toEqual([]);
    });

    it('documents nothing the app does not serve', () => {
        const phantom = documentedOperations().filter(
            (op) => !registeredOperations().includes(op),
        );

        // This is the failure the old collection shipped with for months.
        expect(phantom).toEqual([]);
    });

    it('generates request schemas from the DTOs', () => {
        // Proof the schemas are derived rather than transcribed: this constraint
        // exists only in user.dto.ts and was never typed into the document.
        const login = openApiDocument.components.schemas.Login as any;

        expect(login.properties.email.format).toBe('email');
        expect(login.required).toContain('password');
    });

    it('describes the public endpoints as needing no auth', () => {
        const board = openApiDocument.paths['/jobs'].get as any;
        const logout = openApiDocument.paths['/auth/logout'].post as any;

        expect(board.security).toEqual([]);
        expect(logout.security).toBeUndefined(); // inherits the global cookieAuth
    });

    it('serves the document at /docs.json without auth', async () => {
        const res = await api().get('/docs.json');

        expect(res.status).toBe(200);
        expect(res.body.openapi).toBe('3.1.0');
        expect(res.body.paths['/auth/login']).toBeDefined();
    });

    it('serves the Swagger UI page', async () => {
        const res = await api().get('/docs/');

        expect(res.status).toBe(200);
        expect(res.text).toContain('swagger-ui');
    });
});
