import { getDb } from "./db";
import curriculum from "../seeds/curriculum.json";

let seeded = false;

/**
 * Seed curriculum if the table is empty. Safe to call on every request.
 */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;

  const db = getDb();
  const count = await db.execute("SELECT COUNT(*) as cnt FROM curriculum_items");
  if ((count.rows[0].cnt as number) > 0) {
    seeded = true;
    return;
  }

  for (const item of curriculum) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO curriculum_items
            (id, cefr_level, kind, label, description, prereq_ids, seed_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.id,
        item.cefr_level,
        item.kind,
        item.label,
        item.description,
        item.prereq_ids,
        item.seed_order,
      ],
    });
  }

  seeded = true;
}
