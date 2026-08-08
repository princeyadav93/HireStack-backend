import { describe, expect, it } from 'vitest';
import { escapeRegex } from '../../src/utils/escapeRegex';

/**
 * Search terms are interpolated into a RegExp for the job board and candidate
 * filters. Unescaped, `.*` quietly returns the entire collection and a term
 * like `(a+)+$` can be made to backtrack catastrophically.
 */

describe('escapeRegex', () => {
    it('leaves ordinary text alone', () => {
        expect(escapeRegex('backend engineer')).toBe('backend engineer');
    });

    it('stops a wildcard from matching everything', () => {
        const pattern = new RegExp(escapeRegex('.*'));

        expect(pattern.test('.*')).toBe(true);
        expect(pattern.test('Senior Developer')).toBe(false);
    });

    it('treats a dot as a literal dot', () => {
        const pattern = new RegExp(escapeRegex('node.js'));

        expect(pattern.test('node.js')).toBe(true);
        expect(pattern.test('nodexjs')).toBe(false);
    });

    it('survives characters that would otherwise be invalid on their own', () => {
        // Each of these throws "Invalid regular expression" if passed through raw.
        for (const term of ['c++', '(', '[', 'a|b', '?', '{2,}', '\\']) {
            const escaped = escapeRegex(term);

            expect(() => new RegExp(escaped)).not.toThrow();
            expect(new RegExp(escaped).test(term)).toBe(true);
        }
    });

    it('defuses a catastrophic-backtracking payload', () => {
        const payload = '(a+)+$';
        const pattern = new RegExp(escapeRegex(payload));

        // Matched literally, so 40 a's is 40 character comparisons rather than
        // an exponential walk.
        const start = performance.now();
        expect(pattern.test('a'.repeat(40) + 'b')).toBe(false);
        expect(performance.now() - start).toBeLessThan(100);
    });

    it('behaves like a literal substring search, which is how callers use it', () => {
        const search = (term: string, values: string[]) => {
            const pattern = new RegExp(escapeRegex(term), 'i');
            return values.filter((value) => pattern.test(value));
        };

        const jobs = ['Node.js Developer', 'Nodexjs Developer', 'C++ Engineer'];

        expect(search('node.js', jobs)).toEqual(['Node.js Developer']);
        expect(search('c++', jobs)).toEqual(['C++ Engineer']);
        expect(search('.*', jobs)).toEqual([]);
    });
});
