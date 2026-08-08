import { describe, expect, it } from 'vitest';
import {
    ALLOWED_APPLICATION_TRANSITIONS,
    ApplicationStatus,
} from '../../src/constants/enums';

/**
 * The transition table is the whole authorisation model for the recruiter
 * pipeline — updateApplicationStatusService does nothing but look moves up in
 * it. A wrong entry here is a rejected candidate quietly being revived, and
 * nothing else in the codebase would catch it.
 */

const ALL_STATUSES = Object.values(ApplicationStatus);
const TERMINAL = [ApplicationStatus.HIRED, ApplicationStatus.REJECTED];

describe('ALLOWED_APPLICATION_TRANSITIONS', () => {
    it('covers every status, so a lookup can never be undefined', () => {
        for (const status of ALL_STATUSES) {
            expect(
                ALLOWED_APPLICATION_TRANSITIONS[status],
                `no entry for ${status}`,
            ).toBeInstanceOf(Array);
        }
    });

    it('only ever points at real statuses', () => {
        for (const [from, targets] of Object.entries(
            ALLOWED_APPLICATION_TRANSITIONS,
        )) {
            for (const to of targets) {
                expect(ALL_STATUSES, `${from} → ${to}`).toContain(to);
            }
        }
    });

    it('moves forward one step at a time', () => {
        expect(
            ALLOWED_APPLICATION_TRANSITIONS[ApplicationStatus.APPLIED],
        ).toContain(ApplicationStatus.SHORTLISTED);

        expect(
            ALLOWED_APPLICATION_TRANSITIONS[ApplicationStatus.SHORTLISTED],
        ).toContain(ApplicationStatus.INTERVIEW);

        expect(
            ALLOWED_APPLICATION_TRANSITIONS[ApplicationStatus.INTERVIEW],
        ).toContain(ApplicationStatus.HIRED);
    });

    it('does not let a stage be skipped', () => {
        // Hiring someone nobody interviewed, or interviewing someone nobody
        // shortlisted, should require walking the pipeline.
        expect(
            ALLOWED_APPLICATION_TRANSITIONS[ApplicationStatus.APPLIED],
        ).not.toContain(ApplicationStatus.INTERVIEW);

        expect(
            ALLOWED_APPLICATION_TRANSITIONS[ApplicationStatus.APPLIED],
        ).not.toContain(ApplicationStatus.HIRED);

        expect(
            ALLOWED_APPLICATION_TRANSITIONS[ApplicationStatus.SHORTLISTED],
        ).not.toContain(ApplicationStatus.HIRED);
    });

    it('allows rejection from every stage that is still open', () => {
        const open = ALL_STATUSES.filter((s) => !TERMINAL.includes(s));

        for (const status of open) {
            expect(
                ALLOWED_APPLICATION_TRANSITIONS[status],
                `cannot reject from ${status}`,
            ).toContain(ApplicationStatus.REJECTED);
        }
    });

    it('makes HIRED and REJECTED terminal', () => {
        for (const status of TERMINAL) {
            expect(
                ALLOWED_APPLICATION_TRANSITIONS[status],
                `${status} should be a dead end`,
            ).toEqual([]);
        }
    });

    it('never allows a status to transition to itself', () => {
        for (const status of ALL_STATUSES) {
            expect(
                ALLOWED_APPLICATION_TRANSITIONS[status],
                `${status} loops back to itself`,
            ).not.toContain(status);
        }
    });
});
