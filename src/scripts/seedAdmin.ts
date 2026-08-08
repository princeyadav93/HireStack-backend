/**
 * Create the first platform admin.
 *
 * POST /admin/register now requires an existing admin, so the very first one
 * has to be created out-of-band — from a machine that already has database
 * credentials, rather than by anyone who can reach the API.
 *
 * Usage:
 *   npm run seed:admin -- --email admin@example.com --name "Ops" --password "..."
 *
 * Or via env vars: ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD
 */
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { ENV } from '../config/env';
import { User } from '../models/user.model';

const parseArgs = (): Record<string, string> => {
    const args: Record<string, string> = {};

    for (let i = 2; i < process.argv.length; i += 1) {
        const arg = process.argv[i];
        if (!arg.startsWith('--')) continue;

        const key = arg.slice(2);
        const next = process.argv[i + 1];

        if (next && !next.startsWith('--')) {
            args[key] = next;
            i += 1;
        }
    }

    return args;
};

const run = async (): Promise<void> => {
    const args = parseArgs();

    const name = args.name ?? process.env.ADMIN_NAME;
    const email = args.email ?? process.env.ADMIN_EMAIL;
    const password = args.password ?? process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
        console.error(
            'Missing input. Provide --name, --email and --password ' +
                '(or ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD).',
        );
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
    }

    await mongoose.connect(ENV.MONGODB_URI);

    try {
        const normalisedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({ email: normalisedEmail });

        if (existing) {
            console.error(
                `A user with ${normalisedEmail} already exists (role: ${existing.role}).`,
            );
            process.exit(1);
        }

        const hashedPassword = await bcrypt.hash(password, ENV.SALTROUNDS);

        const admin = await User.create({
            name,
            email: normalisedEmail,
            password: hashedPassword,
            role: 'admin',
            // Created by someone who already holds database credentials, and
            // there is no inbox to mail a link to from a one-shot script.
            isEmailVerified: true,
        });

        console.log(`✅ Platform admin created: ${admin.email} (${admin._id})`);
    } finally {
        await mongoose.disconnect();
    }
};

run().catch((error) => {
    console.error('Failed to seed admin:', error);
    process.exit(1);
});
