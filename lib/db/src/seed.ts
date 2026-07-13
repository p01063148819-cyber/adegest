import { db, pool, usersTable } from "./index";

async function seed() {
  await db
    .insert(usersTable)
    .values([
      { role: "admin", senhaHash: null },
      { role: "vendedor", senhaHash: null },
    ])
    .onConflictDoNothing({ target: usersTable.role });

  console.log("Seed concluído: usuários admin/vendedor garantidos.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
