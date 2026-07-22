export function databaseSslOptions(environment = process.env) {
  const ca = environment.DB_SSL_CA?.replace(/\\n/g, "\n");
  const rejectUnauthorized =
    environment.DB_SSL_REJECT_UNAUTHORIZED === "true" || Boolean(ca);

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
  };
}
