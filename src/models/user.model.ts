import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { IUser } from '../types/user.types';
import { TOKEN_TYPE } from '../types/auth.types';
import { ENV } from '../config/env';

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please use a valid email'],
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false,
        },
        role: {
            type: String,
            enum: ['candidate', 'recruiter', 'admin'],
            default: 'candidate',
        },
        refreshToken: {
            type: String,
            select: false, // never returned by default
        },
        tokenVersion: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true },
);

// Belt and braces: even if a query forgets `.select('-password')`, secrets
// never reach a JSON response body.
userSchema.set('toJSON', {
    transform: (_doc, ret) => {
        const plain = ret as unknown as Record<string, unknown>;
        delete plain.password;
        delete plain.refreshToken;
        delete plain.tokenVersion;
        delete plain.__v;
        return plain;
    },
});

userSchema.methods.isPasswordCorrect = async function (
    password: string,
): Promise<boolean> {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.accessTokenGenerate = function (): string {
    return jwt.sign(
        {
            userId: this._id,
            email: this.email,
            role: this.role,
            tokenVersion: this.tokenVersion ?? 0,
            type: TOKEN_TYPE.ACCESS,
        },
        ENV.JWT_SECRET,
        { expiresIn: '1d' },
    );
};

userSchema.methods.refreshTokenGenerate = function (): string {
    return jwt.sign(
        { userId: this._id, type: TOKEN_TYPE.REFRESH },
        ENV.REFRESH_TOKEN_SECRET,
        {
            expiresIn: ENV.REFRESH_TOKEN_EXPIRY as unknown as number,
            // `iat` only has second resolution, so without a unique claim two
            // tokens minted in the same second are byte-identical and rotation
            // hands back the very token it was meant to replace.
            jwtid: randomUUID(),
        },
    );
};

export type { IUser } from '../types/user.types';
export const User = mongoose.model<IUser>('User', userSchema);
