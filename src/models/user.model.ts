import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

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
export const User = mongoose.model<IUser>('User', userSchema);
