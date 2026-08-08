import { Document, Types } from 'mongoose';
import { VerificationTokenType } from '../constants/enums';

export interface IVerificationToken extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    /** SHA-256 of the token that was emailed. The token itself is never stored. */
    tokenHash: string;
    type: VerificationTokenType;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
