import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyRole } from '../../src/constants/enums';
import { Company } from '../../src/models/company.model';
import { useTestDatabase } from '../helpers/db';
import { api, login } from '../helpers/api';
import { createRecruiterWithCompany, TEST_PASSWORD } from '../helpers/factories';

/**
 * Cloudinary is the one dependency here that is not ours, costs money, and
 * needs the network. Stubbing the uploader keeps the test about our rules —
 * who may upload, what we accept, what we write — rather than about whether a
 * third party is reachable from CI.
 */
const uploadStream = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/cloudinary', () => ({
    default: { uploader: { upload_stream: uploadStream } },
}));

const UPLOADED_URL = 'https://res.cloudinary.com/test/image/upload/logo.png';

/** Stand in for a real image; the bytes are never decoded, only forwarded. */
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

useTestDatabase();

beforeEach(() => {
    uploadStream.mockReset();

    // cloudinary hands back a writable stream and fires the callback on end().
    uploadStream.mockImplementation((_options, callback) => ({
        end: () => callback(null, { secure_url: UPLOADED_URL }),
    }));
});

describe('PATCH /company/:companyId/logo', () => {
    it('stores the returned URL on the company', async () => {
        const { recruiter, company } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email, TEST_PASSWORD);

        const res = await api()
            .patch(`/company/${company._id}/logo`)
            .set('Cookie', cookies)
            .attach('logo', PNG_BYTES, {
                filename: 'logo.png',
                contentType: 'image/png',
            });

        expect(res.status).toBe(200);
        expect(res.body.data.logo.url).toBe(UPLOADED_URL);

        const saved = await Company.findById(company._id).lean();
        expect(saved?.logo?.url).toBe(UPLOADED_URL);
        expect(saved?.logo?.fileName).toBe('logo.png');
    });

    it('overwrites the previous file instead of orphaning it', async () => {
        const { recruiter, company } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email, TEST_PASSWORD);

        await api()
            .patch(`/company/${company._id}/logo`)
            .set('Cookie', cookies)
            .attach('logo', PNG_BYTES, {
                filename: 'logo.png',
                contentType: 'image/png',
            });

        // A stable public_id is what makes a re-upload replace the old image
        // rather than leave it behind on Cloudinary forever.
        expect(uploadStream).toHaveBeenCalledWith(
            expect.objectContaining({
                public_id: company._id.toString(),
                overwrite: true,
            }),
            expect.any(Function),
        );
    });

    it('rejects a non-image and never calls Cloudinary', async () => {
        const { recruiter, company } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email, TEST_PASSWORD);

        const res = await api()
            .patch(`/company/${company._id}/logo`)
            .set('Cookie', cookies)
            .attach('logo', Buffer.from('%PDF-1.4'), {
                filename: 'brochure.pdf',
                contentType: 'application/pdf',
            });

        expect(res.status).toBe(400);
        expect(uploadStream).not.toHaveBeenCalled();
    });

    it('rejects an ADMIN — logo is company detail, so OWNER only', async () => {
        const { recruiter, company } = await createRecruiterWithCompany({
            role: CompanyRole.ADMIN,
        });
        const cookies = await login(recruiter.email, TEST_PASSWORD);

        const res = await api()
            .patch(`/company/${company._id}/logo`)
            .set('Cookie', cookies)
            .attach('logo', PNG_BYTES, {
                filename: 'logo.png',
                contentType: 'image/png',
            });

        expect(res.status).toBe(403);
        expect(uploadStream).not.toHaveBeenCalled();
    });

    it("refuses to re-brand another company from the URL", async () => {
        const attacker = await createRecruiterWithCompany({
            companyName: 'Attacker Inc',
        });
        const victim = await createRecruiterWithCompany({
            companyName: 'Victim Inc',
        });
        const cookies = await login(attacker.recruiter.email, TEST_PASSWORD);

        // A genuine OWNER, but of a different company — the id in the URL must
        // not be what decides which record gets written.
        const res = await api()
            .patch(`/company/${victim.company._id}/logo`)
            .set('Cookie', cookies)
            .attach('logo', PNG_BYTES, {
                filename: 'logo.png',
                contentType: 'image/png',
            });

        expect(res.status).toBe(403);

        const untouched = await Company.findById(victim.company._id).lean();
        expect(untouched?.logo?.url).toBeUndefined();
    });

    it('leaves the existing logo intact when Cloudinary fails', async () => {
        const { recruiter, company } = await createRecruiterWithCompany();
        const cookies = await login(recruiter.email, TEST_PASSWORD);

        await Company.findByIdAndUpdate(company._id, {
            $set: { 'logo.url': 'https://old.example/logo.png' },
        });

        uploadStream.mockImplementation((_options, callback) => ({
            end: () => callback(new Error('cloudinary is down'), undefined),
        }));

        const res = await api()
            .patch(`/company/${company._id}/logo`)
            .set('Cookie', cookies)
            .attach('logo', PNG_BYTES, {
                filename: 'logo.png',
                contentType: 'image/png',
            });

        expect(res.status).toBe(500);

        // The point of uploading before writing: a failed upload must not blank
        // a logo that was working a moment ago.
        const saved = await Company.findById(company._id).lean();
        expect(saved?.logo?.url).toBe('https://old.example/logo.png');
    });
});
