import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Importing the models registers their schemas — and their indexes — before
// anything queries them.
import '../../src/models/user.model';
import '../../src/models/company.model';
import '../../src/models/companyMember.model';
import '../../src/models/candidateProfile.model';
import '../../src/models/recruiterProfile.model';
import '../../src/models/job.model';
import '../../src/models/application.model';

/**
 * Connect this file to the shared in-memory MongoDB and wipe it between tests.
 *
 * Call once at the top level of an integration test file:
 *
 *     useTestDatabase();
 *
 * Unit tests should not call it — they stay in-process and finish in
 * milliseconds.
 */
export const useTestDatabase = () => {
    beforeAll(async () => {
        const uri = process.env.MONGO_TEST_URI;

        if (!uri) {
            throw new Error(
                'MONGO_TEST_URI is not set — tests/setup/globalSetup.ts did not run. ' +
                    'Run tests through `npm test`, not vitest with a different config.',
            );
        }

        // Vitest runs test files across several worker processes against the
        // same mongod. Without a database per worker, one file's afterEach
        // wipes another file's fixtures mid-test.
        const worker = process.env.VITEST_POOL_ID ?? '1';

        await mongoose.connect(uri, { dbName: `hirestack_test_${worker}` });

        // Mongoose builds indexes in the background and does not wait. Several
        // tests assert on behaviour that only exists once they are built — the
        // unique (jobId, candidateId) index is what turns a second application
        // into a 409 — so block until they are.
        await Promise.all(
            Object.values(mongoose.models).map((model) => model.createIndexes()),
        );
    });

    afterEach(async () => {
        // deleteMany, not dropDatabase: dropping takes the indexes with it, and
        // the next test would silently run without the unique constraints it is
        // there to verify.
        await Promise.all(
            Object.values(mongoose.connection.collections).map((collection) =>
                collection.deleteMany({}),
            ),
        );
    });

    afterAll(async () => {
        await mongoose.disconnect();
    });
};
