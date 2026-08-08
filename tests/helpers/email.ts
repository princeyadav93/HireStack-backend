import { OutgoingEmail, testInbox } from '../../src/services/email.service';

/**
 * Reading the outbox.
 *
 * Under NODE_ENV=test the mailer keeps messages in an array instead of sending
 * them, which is what lets a test do what a user does: receive the mail, take
 * the link out of it, and follow it. Asserting on the token straight from the
 * database would skip the part most likely to break.
 */

export { testInbox };

export const lastEmailTo = (address: string): OutgoingEmail => {
    const email = testInbox.lastFor(address);

    if (!email) {
        const seen = testInbox.all().map((m) => m.to);
        throw new Error(
            `No email was sent to ${address}. Inbox holds: ${seen.length ? seen.join(', ') : '(nothing)'}`,
        );
    }

    return email;
};

/** The token out of the link, exactly as a user clicking it would send it back. */
export const tokenFromEmail = (email: OutgoingEmail): string => {
    const match = email.text.match(/[?&]token=([^\s&]+)/);

    if (!match) {
        throw new Error(
            `No token link in email "${email.subject}":\n${email.text}`,
        );
    }

    return decodeURIComponent(match[1]);
};

export const tokenFromLastEmailTo = (address: string): string =>
    tokenFromEmail(lastEmailTo(address));
