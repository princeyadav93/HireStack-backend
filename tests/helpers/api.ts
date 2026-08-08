import request from 'supertest';
import app from '../../src/app';
import { TEST_PASSWORD } from './factories';

/**
 * Fires requests at the real Express app — every middleware, route and error
 * handler included — without binding a port.
 */
export const api = () => request(app);

/**
 * Log in and return the Set-Cookie header, ready to hand back to a request:
 *
 *     await api().get('/jobs/manage').set('Cookie', cookies);
 *
 * Auth is cookie-based, so this is the only way to reach a protected route.
 */
export const login = async (
    email: string,
    password: string = TEST_PASSWORD,
): Promise<string[]> => {
    const res = await request(app)
        .post('/auth/login')
        .send({ email, password });

    if (res.status !== 200) {
        throw new Error(
            `Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`,
        );
    }

    return res.headers['set-cookie'] as unknown as string[];
};

/** Pull one cookie's value out of a Set-Cookie header, attributes stripped. */
export const cookieValue = (
    cookies: string[] | undefined,
    name: string,
): string | undefined =>
    cookies
        ?.find((cookie) => cookie.startsWith(`${name}=`))
        ?.split(';')[0]
        .split('=')[1];
