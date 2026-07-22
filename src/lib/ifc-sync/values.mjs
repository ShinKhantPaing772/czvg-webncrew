const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalized(value) {
  return stringValue(value).toLocaleLowerCase("en-US");
}

export function isUuid(value) {
  return UUID_PATTERN.test(stringValue(value));
}
