import { ProfileInput } from '../dtos/userProfile.dto';

// ✅ normalize
export const normalize = (data: ProfileInput): ProfileInput => {
    if (data.skills) {
        data.skills = [
            ...new Set(data.skills.map((s) => s.toLowerCase().trim())),
        ];
    }

    if (data.preferences?.locations) {
        data.preferences.locations = [
            ...new Set(
                data.preferences.locations.map((l) => l.toLowerCase().trim()),
            ),
        ];
    }

    return data;
};

// ✅ safe flatten
export const flatten = (obj: any, prefix = ''): Record<string, any> => {
    let res: Record<string, any> = {};

    for (let key in obj) {
        if (key.startsWith('$')) continue; // 🔒 prevent injection

        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(res, flatten(value, newKey));
        } else {
            res[newKey] = value;
        }
    }

    return res;
};

// ✅ build mongo update query
export const buildUpdateQuery = (data: ProfileInput) => {
    const flat = flatten(data);

    const update: any = {
        $set: {},
    };

    for (let key in flat) {
        if (key === 'skills') {
            update.$addToSet = {
                skills: { $each: flat[key] },
            };
        } else {
            update.$set[key] = flat[key];
        }
    }

    return update;
};
