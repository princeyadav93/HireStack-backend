/**
 * Escape user input before it becomes part of a RegExp.
 *
 * Without this a search term like `.*` matches everything, and a crafted one
 * can be made to backtrack catastrophically.
 */
export const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
