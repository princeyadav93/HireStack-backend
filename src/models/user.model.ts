import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser } from '../types/user.types';

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
        role: {
            type: String,
            enum: ['candidate', 'recruiter', 'admin'],
            default: 'candidate',
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

// ─── Export ──────────────────────────────────────────────────
export type { IUser } from '../types/user.types';
export const User = mongoose.model<IUser>('User', userSchema);
