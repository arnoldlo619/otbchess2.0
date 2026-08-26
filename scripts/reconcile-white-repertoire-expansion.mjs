/**
 * Reconciles duplicate rows created by early White-repertoire seed runs on
 * databases that do not yet enforce the source slugs as physical unique keys.
 * It preserves one line per canonical source slug, redirects repertoire links,
 * and leaves one parent opening per system.
 */
import { createConnection } from "mysql2/promise";

const slugs = ["english-opening", "catalan-opening", "kings-indian-attack", "reti-opening", "ruy-lopez"];
const connection = await createConnection(process.env.DATABASE_URL);

for (const slug of slugs) {
  await connection.beginTransaction();
  try {
    const [parents] = await connection.execute(
      "SELECT id FROM openings WHERE slug = ? ORDER BY created_at ASC, id ASC",
      [slug]
    );
    if (parents.length === 0) {
      await connection.commit();
      continue;
    }

    const canonicalParentId = parents[0].id;
    const parentIds = parents.map((parent) => parent.id);
    const placeholders = parentIds.map(() => "?").join(", ");
    const [lines] = await connection.query(
      `SELECT id, slug FROM opening_lines WHERE opening_id IN (${placeholders}) ORDER BY created_at ASC, id ASC`,
      parentIds
    );
    const canonicalLines = new Map();

    for (const line of lines) {
      const retainedId = canonicalLines.get(line.slug);
      if (!retainedId) {
        canonicalLines.set(line.slug, line.id);
        continue;
      }
      await connection.execute("UPDATE repertoire_lines SET line_id = ? WHERE line_id = ?", [retainedId, line.id]);
      await connection.execute("DELETE FROM line_nodes WHERE line_id = ?", [line.id]);
      await connection.execute("DELETE FROM opening_lines WHERE id = ?", [line.id]);
    }

    await connection.query(
      `UPDATE opening_lines SET opening_id = ? WHERE opening_id IN (${placeholders})`,
      [canonicalParentId, ...parentIds]
    );
    if (parents.length > 1) {
      await connection.query(
        `DELETE FROM openings WHERE id IN (${parents.slice(1).map(() => "?").join(", ")})`,
        parents.slice(1).map((parent) => parent.id)
      );
    }
    const [[count]] = await connection.execute(
      "SELECT COUNT(*) AS total FROM opening_lines WHERE opening_id = ? AND is_published = 1",
      [canonicalParentId]
    );
    await connection.execute(
      "UPDATE openings SET line_count = ?, estimated_line_count = ? WHERE id = ?",
      [count.total, count.total, canonicalParentId]
    );
    await connection.commit();
    console.log(`${slug}: ${count.total} canonical published lines retained`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

await connection.end();
process.exit(0);
