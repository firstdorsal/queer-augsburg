export type FieldRule = (value: string) => string | null;

// The server's address check, so a value that passes here is not refused after saving.
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const requiredRule: FieldRule = (value) =>
    value.trim() === "" ? "Diese Information ist nicht optional." : null;

export const emailRule: FieldRule = (value) =>
    requiredRule(value) ??
    (EMAIL_PATTERN.test(value) ? null : "Bitte gib eine gültige E-Mail Adresse an.");
