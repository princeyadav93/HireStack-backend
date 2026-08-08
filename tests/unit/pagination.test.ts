import { describe, expect, it } from 'vitest';
import { getPagination } from '../../src/utils/pagination';
import { PAGINATION } from '../../src/constants';

/**
 * Query params arrive as untrusted strings. The two failures that matter are
 * `?limit=999999999`, which pulls a whole collection into memory, and
 * `?page=-5`, which produces a negative skip that Mongo answers with a 500.
 */

describe('getPagination', () => {
    it('falls back to the defaults when nothing is supplied', () => {
        expect(getPagination({})).toEqual({
            page: PAGINATION.DEFAULT_PAGE,
            limit: PAGINATION.DEFAULT_LIMIT,
        });
    });

    it('accepts valid numeric strings', () => {
        expect(getPagination({ page: '3', limit: '25' })).toEqual({
            page: 3,
            limit: 25,
        });
    });

    it('caps limit at MAX_LIMIT', () => {
        expect(getPagination({ limit: '999999999' }).limit).toBe(
            PAGINATION.MAX_LIMIT,
        );
    });

    it('keeps a limit of exactly MAX_LIMIT', () => {
        expect(
            getPagination({ limit: String(PAGINATION.MAX_LIMIT) }).limit,
        ).toBe(PAGINATION.MAX_LIMIT);
    });

    it.each([
        ['negative', '-5'],
        ['zero', '0'],
        ['not a number', 'abc'],
        ['empty', ''],
        ['undefined', undefined],
        ['null', null],
    ])('rejects a %s page and uses the default', (_label, page) => {
        expect(getPagination({ page }).page).toBe(PAGINATION.DEFAULT_PAGE);
    });

    it.each([
        ['negative', '-5'],
        ['zero', '0'],
        ['not a number', 'abc'],
    ])('rejects a %s limit and uses the default', (_label, limit) => {
        expect(getPagination({ limit }).limit).toBe(PAGINATION.DEFAULT_LIMIT);
    });

    it('never produces a negative skip', () => {
        // What the callers actually compute. Anything below zero is a 500.
        for (const page of ['-5', '0', 'abc', undefined]) {
            const { page: p, limit } = getPagination({ page });
            expect((p - 1) * limit).toBeGreaterThanOrEqual(0);
        }
    });

    it('takes the first value when a param is repeated in the query string', () => {
        // Express parses `?page=2&page=9` into an array. String(['2','9']) is
        // "2,9", and parseInt stops at the comma — so the first value wins
        // rather than the whole thing collapsing to the default.
        expect(getPagination({ page: ['2', '9'] }).page).toBe(2);
    });
});
