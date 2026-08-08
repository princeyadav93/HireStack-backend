import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * One in-memory MongoDB for the entire test run.
 *
 * A replica set rather than a standalone server: applyToJobService wraps the
 * insert and the applicationCount increment in session.withTransaction(), and
 * MongoDB only supports transactions on a replica set. A standalone mongod
 * fails those tests with "Transaction numbers are only allowed on a replica
 * set member or mongos".
 *
 * One member is enough — the point is the oplog, not redundancy.
 */

let replSet: MongoMemoryReplSet | undefined;

export async function setup() {
    // The default is 10s, which the very first run misses: the MongoDB binary
    // has to be downloaded and cached, and on Windows the new executable is
    // scanned before it is allowed to run. Later runs start in a second or two.
    process.env.MONGOMS_STARTUP_TIMEOUT ??= '120000';

    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
    });

    // Read back in tests/helpers/db.ts. Workers are forked after this runs, so
    // they inherit it.
    process.env.MONGO_TEST_URI = replSet.getUri();
}

export async function teardown() {
    await replSet?.stop();
}
