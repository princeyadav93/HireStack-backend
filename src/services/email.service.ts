import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../config/env';

/**
 * Outbound email.
 *
 * The transport is chosen from configuration, never imported directly by
 * callers, so switching provider is an env change rather than a code change:
 *
 *   test         → in-memory, assertable, no network
 *   no SMTP_HOST → console, so the whole flow is developable without an account
 *   SMTP_HOST    → the real thing
 *
 * SMTP rather than a provider SDK on purpose. Resend, SendGrid, Mailgun, SES,
 * Gmail and Mailtrap all speak it, so this file does not have to know which
 * one is on the other end.
 */

export interface OutgoingEmail {
    to: string;
    subject: string;
    text: string;
    html: string;
}

type TransportKind = 'memory' | 'console' | 'smtp';

const transportKind = (): TransportKind => {
    if (ENV.NODE_ENV === 'test') return 'memory';
    return ENV.SMTP_HOST ? 'smtp' : 'console';
};

// ─── Test transport ──────────────────────────────────────────

const messages: OutgoingEmail[] = [];

/**
 * Only ever written to under NODE_ENV=test. Tests need to read the link out of
 * an email to follow it, which is the one thing a fake transport must allow.
 */
export const testInbox = {
    all: (): OutgoingEmail[] => [...messages],

    for: (address: string): OutgoingEmail[] =>
        messages.filter((m) => m.to.toLowerCase() === address.toLowerCase()),

    lastFor: (address: string): OutgoingEmail | undefined => {
        const matches = testInbox.for(address);
        return matches[matches.length - 1];
    },

    clear: (): void => {
        messages.length = 0;
    },
};

// ─── SMTP transport ──────────────────────────────────────────

let transporter: Transporter | undefined;

// Built on first send, not on import: this module is loaded by the app (and so
// by every test), and creating it eagerly would open a connection pool in
// processes that never send anything.
const smtpTransport = (): Transporter => {
    transporter ??= nodemailer.createTransport({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        secure: ENV.SMTP_SECURE,
        // Some relays (a local Mailhog, SES over an authorised IP) take no
        // credentials at all; passing empty ones makes them refuse the session.
        ...(ENV.SMTP_USER && {
            auth: { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS },
        }),
    });

    return transporter;
};

// ─── Send ────────────────────────────────────────────────────

export const sendMail = async (email: OutgoingEmail): Promise<void> => {
    switch (transportKind()) {
        case 'memory':
            messages.push(email);
            return;

        case 'console':
            // The text body carries the link, so this is enough to complete a
            // password reset locally with no mail provider configured.
            console.info(
                [
                    '',
                    '─── email (no SMTP_HOST set, not actually sent) ───',
                    `to:      ${email.to}`,
                    `subject: ${email.subject}`,
                    '',
                    email.text,
                    '───────────────────────────────────────────────────',
                    '',
                ].join('\n'),
            );
            return;

        case 'smtp':
            await smtpTransport().sendMail({
                from: ENV.EMAIL_FROM,
                to: email.to,
                subject: email.subject,
                text: email.text,
                html: email.html,
            });
    }
};
