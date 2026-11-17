/** Insert grants and their inbox notifications atomically, notifying only new grants. */
export async function insertAwardGrants(connection, grants, notifications) {
  if (!grants.length) return 0;
  const values = [];
  const candidates = grants.map(([awardId, pilotId, awardedAt], index) => {
    const [, icon, subject, content] = notifications[index];
    const offset = values.length;
    values.push(awardId, pilotId, awardedAt, icon, subject, content);
    return `($${offset + 1}::integer, $${offset + 2}::integer, $${offset + 3}::timestamptz, $${offset + 4}::text, $${offset + 5}::text, $${offset + 6}::text)`;
  });
  const result = await connection.query(`
    WITH candidates (awardid, pilotid, dateawarded, icon, subject, content) AS (
      VALUES ${candidates.join(", ")}
    ), inserted AS (
      INSERT INTO awards_granted (awardid, pilotid, dateawarded)
      SELECT awardid, pilotid, dateawarded FROM candidates WHERE TRUE
      ON CONFLICT (pilotid, awardid) DO NOTHING
      RETURNING awardid, pilotid
    )
    INSERT INTO notifications (pilotid, icon, subject, content, datetime)
    SELECT candidates.pilotid, candidates.icon, candidates.subject, candidates.content, candidates.dateawarded
    FROM candidates
    INNER JOIN inserted USING (awardid, pilotid)
  `, values);
  return result.rowCount;
}
