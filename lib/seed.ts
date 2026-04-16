import { getDb } from "./db";
import { runMigrations } from "./migrate";
import curriculum from "../seeds/curriculum.json";

export async function seedCurriculum(): Promise<void> {
  const db = getDb();

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

  console.log(`Seeded ${curriculum.length} curriculum items.`);
}

// Run directly via `npx tsx lib/seed.ts`
if (require.main === module) {
  (async () => {
    await runMigrations();
    await seedCurriculum();
    process.exit(0);
  })().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
