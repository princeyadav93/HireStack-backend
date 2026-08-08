import { ENV } from '../config/env';
import { OutgoingEmail } from '../services/email.service';

/**
 * The bodies of the account emails.
 *
 * Kept out of the services so a wording or styling change never touches token
 * logic, and so a test can assert on a link without rendering HTML.
 */

// Names are user-supplied and land inside an HTML body. Mail clients strip
// <script>, but they do render markup, so a name is escaped like any other
// untrusted string.
const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

// Links point at the frontend, which reads the token from the query string and
// posts it back to this API.
const linkTo = (path: string, token: string): string =>
    `${ENV.APP_URL.replace(/\/+$/, '')}/${path}?token=${encodeURIComponent(token)}`;

const layout = (heading: string, body: string, cta: [string, string]): string => {
    const [label, href] = cta;

    return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
  ${body}
  <p style="margin:24px 0">
    <a href="${href}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block">${label}</a>
  </p>
  <p style="font-size:13px;color:#666;margin:0">
    If the button does not work, paste this into your browser:<br>
    <span style="word-break:break-all">${href}</span>
  </p>
</div>`;
};

export const verificationEmail = (
    to: string,
    name: string,
    token: string,
): OutgoingEmail => {
    const href = linkTo('verify-email', token);

    return {
        to,
        subject: 'Verify your email address',
        text: [
            `Hi ${name},`,
            '',
            'Confirm your email address to finish setting up your HireStack account:',
            href,
            '',
            'This link expires in 24 hours.',
            'If you did not create an account, you can ignore this email.',
        ].join('\n'),
        html: layout(
            'Verify your email address',
            `<p style="margin:0 0 12px">Hi ${escapeHtml(name)}, confirm your email address to finish setting up your HireStack account.</p>
  <p style="margin:0;font-size:13px;color:#666">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>`,
            ['Verify email', href],
        ),
    };
};

export const passwordResetEmail = (
    to: string,
    name: string,
    token: string,
): OutgoingEmail => {
    const href = linkTo('reset-password', token);

    return {
        to,
        subject: 'Reset your password',
        text: [
            `Hi ${name},`,
            '',
            'Use this link to choose a new password:',
            href,
            '',
            'This link expires in 1 hour and can only be used once.',
            'If you did not ask for a reset, ignore this email — your password has not changed.',
        ].join('\n'),
        html: layout(
            'Reset your password',
            `<p style="margin:0 0 12px">Hi ${escapeHtml(name)}, use the button below to choose a new password.</p>
  <p style="margin:0;font-size:13px;color:#666">This link expires in 1 hour and can only be used once. If you did not ask for a reset, ignore this email — your password has not changed.</p>`,
            ['Choose a new password', href],
        ),
    };
};

/**
 * Sent after a reset succeeds. This is the message that tells a victim their
 * account was taken over, so it goes out even though nothing needs clicking.
 */
export const passwordChangedEmail = (
    to: string,
    name: string,
): OutgoingEmail => ({
    to,
    subject: 'Your password was changed',
    text: [
        `Hi ${name},`,
        '',
        'Your HireStack password was just changed, and every device that was signed in has been signed out.',
        '',
        'If this was not you, reset your password immediately:',
        `${ENV.APP_URL.replace(/\/+$/, '')}/forgot-password`,
    ].join('\n'),
    html: layout(
        'Your password was changed',
        `<p style="margin:0 0 12px">Hi ${escapeHtml(name)}, your HireStack password was just changed and every signed-in device has been signed out.</p>
  <p style="margin:0;font-size:13px;color:#666">If this was not you, reset your password immediately.</p>`,
        ['Reset your password', `${ENV.APP_URL.replace(/\/+$/, '')}/forgot-password`],
    ),
});
