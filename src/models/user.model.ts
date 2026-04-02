import mongoose, { Schema, Document, CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env'; // adjust path as needed

// ─── Interface ───────────────────────────────────────────────
export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    resume?: string;

    // Custom methods
    isPasswordCorrect(password: string): Promise<boolean>;
    accessTokenGenerate(): string;
    refreshTokenGenerate(): string;
}

// ─── Schema ──────────────────────────────────────────────────
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
        resume: {
            type: String,
        },
    },
    {
        timestamps: true,
    },
);

// ─── Methods ─────────────────────────────────────────────────
userSchema.methods.isPasswordCorrect = async function (
    password: string,
): Promise<boolean> {
    return await bcrypt.compare(password, this.password);
};

// userSchema.methods.accessTokenGenerate = function (): string {
//     return jwt.sign(
//         {
//             _id: this._id,
//             email: this.email,
//         },
//         getEnv('ACCESS_TOKEN_SECRET'),
//         {
//             expiresIn: getEnv('ACCESS_TOKEN_EXPIRY'),
//         } as jwt.SignOptions,
//     );
// };

// userSchema.methods.refreshTokenGenerate = function (): string {
//     return jwt.sign(
//         {
//             _id: this._id,
//         },
//         getEnv('REFRESH_TOKEN_SECRET'),
//         {
//             expiresIn: getEnv('REFRESH_TOKEN_EXPIRY'),
//         } as jwt.SignOptions,
//     );
// };

// ─── Export ──────────────────────────────────────────────────
export const User = mongoose.model<IUser>('User', userSchema);
