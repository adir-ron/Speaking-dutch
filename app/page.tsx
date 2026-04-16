import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { pickTarget } from "@/lib/learner-model";
import { composeGreeting } from "@/lib/memory-greeting";
import { getOpeningLines } from "@/lib/prompt-composer";
import { runMigrations } from "@/lib/migrate";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Ensure DB is migrated
  await runMigrations();

  const target = await pickTarget();
  const greeting = await composeGreeting(target.label);
  const openingLines = getOpeningLines(target.id);

  return (
    <HomeClient
      greeting={greeting}
      targetItem={{
        id: target.id,
        label: target.label,
        openingLines,
      }}
    />
  );
}
