export const SIGNUP_NAME_INPUT_PATTERN = "[A-Za-z0-9 ]+";

const SIGNUP_NAME_PATTERN = /^[A-Za-z0-9 ]+$/;
const DISALLOWED_SIGNUP_NAME_CHARACTERS = /[^A-Za-z0-9 ]/g;

export function sanitizeSignupName(value: string) {
  return value.replace(DISALLOWED_SIGNUP_NAME_CHARACTERS, "");
}

export function isValidSignupName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    SIGNUP_NAME_PATTERN.test(value.trim())
  );
}
