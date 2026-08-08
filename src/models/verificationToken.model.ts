import mongoose, { Schema } from 'mongoose';
import { IVerificationToken } from '../types/verificationToken.types';
import { VerificationTokenType } from '../constants/enums';

/**
 * One-time tokens for email verification and password reset.
 *
 * Their own collection rather than fields on User: two token types would
 * otherwise mean four more columns on every user document, and a token that
 * expires wants to disappear on its own rather than linger as a stale field.
 */
const verificationTokenSchema = new Schema<IVerificationToken>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true, // "revoke this user's outstanding tokens"
        },
        // Only the hash is stored. Read access to this collection — a leaked
        // backup, an aggregation pipeline, a log — must not hand anyone a
        // working password-reset link.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
        type: {
            type: String,
            enum: Object.values(VerificationTokenType),
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true },
);

// Housekeeping, not enforcement. Mongo's TTL monitor sweeps about once a
// minute, so an expired token can still be sitting in the collection when it is
// looked up — consumeToken checks expiresAt itself and does not rely on this.
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type { IVerificationToken } from '../types/verificationToken.types';
export const VerificationToken = mongoose.model<IVerificationToken>(
    'VerificationToken',
    verificationTokenSchema,
);
