import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/db';
import { api } from '../helpers/api';
import { createJob, createRecruiterWithCompany } from '../helpers/factories';
import { HTTP_STATUS } from '../../src/constants';

useTestDatabase();

/**
 * The public board's two numeric filters, which used to be named backwards:
 * `maxSalary=2000000` returned the jobs paying *at most* 20 LPA. These tests
 * are as much about what the query string means to a candidate as about the
 * query itself, so they assert on titles rather than on counts.
 */

/** Four published jobs at one approved company, spanning the awkward cases. */
const board = async () => {
    const { recruiter, company } = await createRecruiterWithCompany();

    const make = (
        title: string,
        experience?: { min?: number; max?: number },
        salary?: { min?: number; max?: number },
    ) =>
        createJob({
            companyId: company._id,
            createdBy: recruiter._id,
            title,
            experience,
            salary,
        });

    await make(
        'Junior Backend Engineer',
        { min: 0, max: 2 },
        { min: 600000, max: 1000000 },
    );
    await make(
        'Mid Backend Engineer',
        { min: 3, max: 6 },
        { min: 1500000, max: 2500000 },
    );
    // Open-ended — "40 LPA and up". This is the shape a `salary.max` test on
    // its own would lose, and it is the best-paid job on the board.
    await make('Principal Platform Engineer', { min: 8 }, { min: 4000000 });
    // Salary withheld, which is common and must not be read as paying zero.
    await make('Support Engineer', { min: 1, max: 3 });

    return { company };
};

const titles = async (query: string) => {
    const res = await api().get(`/jobs${query}`);

    expect(res.status).toBe(HTTP_STATUS.OK);

    return (res.body.data.jobs as { title: string }[])
        .map((job) => job.title)
        .sort();
};

describe('GET /jobs — maxExperience', () => {
    it('returns the jobs that many years qualifies you for', async () => {
        await board();

        expect(await titles('?maxExperience=3')).toEqual([
            'Junior Backend Engineer',
            'Mid Backend Engineer',
            'Support Engineer',
        ]);
    });

    it('excludes jobs demanding more experience than was given', async () => {
        await board();

        expect(await titles('?maxExperience=0')).toEqual([
            'Junior Backend Engineer',
        ]);
    });
});

describe('GET /jobs — minSalary', () => {
    it('returns jobs paying at least the figure, not at most it', async () => {
        await board();

        // The regression the rename exists for: read the old way, this asked
        // for jobs capped at 20 LPA and returned only the junior role.
        expect(await titles('?minSalary=2000000')).toEqual([
            'Mid Backend Engineer',
            'Principal Platform Engineer',
        ]);
    });

    it('keeps a range that published no maximum', async () => {
        await board();

        expect(await titles('?minSalary=3000000')).toEqual([
            'Principal Platform Engineer',
        ]);
    });

    it('drops jobs that published no salary at all', async () => {
        await board();

        expect(await titles('?minSalary=1')).not.toContain('Support Engineer');
    });
});

describe('GET /jobs — filters combine', () => {
    it('applies the salary floor and the search term together', async () => {
        await board();

        expect(await titles('?search=Engineer&minSalary=4000000')).toEqual([
            'Principal Platform Engineer',
        ]);
    });

    it('does not let the search term overwrite the salary floor', async () => {
        await board();

        // Both clauses want the top level of the match. Search owns `$or`, so
        // the salary floor has to live under `$and` — build it any other way
        // and one assignment silently replaces the other, and this search
        // returns the very job the floor excludes.
        expect(await titles('?search=Junior&minSalary=2000000')).toEqual([]);
    });
});
