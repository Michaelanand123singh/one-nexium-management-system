/**
 * Creates (or recreates) a Workstation device for E2E agent tests.
 * Prints the plaintext ingest token to stdout (one line).
 *
 * Run from repo root: npx tsx prisma/scripts/workstation-e2e-device.ts
 * Requires: Organisation slug `onenexium`, User `admin@onenexium.com`
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function generateIngestToken(): string {
  return randomBytes(32).toString("hex");
}

function hashIngestToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

async function main() {
  const org = await prisma.organisation.findFirst({ where: { slug: "onenexium" } });
  if (!org) {
    console.error("No organisation with slug 'onenexium'. Run db:seed first.");
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email: "admin@onenexium.com" } });
  if (!user) {
    console.error("No user admin@onenexium.com. Run db:seed first.");
    process.exit(1);
  }

  await prisma.workstationDevice.deleteMany({
    where: { organisationId: org.id, label: "e2e-agent-test" },
  });

  const plain = generateIngestToken();
  await prisma.workstationDevice.create({
    data: {
      organisationId: org.id,
      userId: user.id,
      label: "e2e-agent-test",
      tokenHash: hashIngestToken(plain),
    },
  });

  process.stdout.write(`${plain}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
