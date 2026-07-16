import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type Account = {
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "PRODUCT_MANAGER" | "ENGINEERING_LEAD" | "DEVELOPER";
  dept: "LEADERSHIP" | "PRODUCT" | "ENGINEERING";
  password: string;
};

/** Primary assignable roles only (YAGNI). */
const ACCOUNTS: Account[] = [
  { email: "admin@onenexium.com", name: "Super Admin", role: "SUPER_ADMIN", dept: "LEADERSHIP", password: "admin123" },
  { email: "pm@onenexium.com", name: "Product Manager", role: "PRODUCT_MANAGER", dept: "PRODUCT", password: "pm123" },
  { email: "englead@onenexium.com", name: "Engineering Lead", role: "ENGINEERING_LEAD", dept: "ENGINEERING", password: "englead123" },
  { email: "dev@onenexium.com", name: "Developer", role: "DEVELOPER", dept: "ENGINEERING", password: "dev123" },
];

/** Legacy seed emails that share primary roles — kept in sync for old bookmarks. */
const LEGACY: Account[] = [
  { email: "engineer1@onenexium.com", name: "Engineering Lead", role: "ENGINEERING_LEAD", dept: "ENGINEERING", password: "engineer1123" },
  { email: "engineer2@onenexium.com", name: "Developer", role: "DEVELOPER", dept: "ENGINEERING", password: "engineer2123" },
];

async function main() {
  const org = await prisma.organisation.findFirst({ where: { slug: "onenexium" } });
  if (!org) throw new Error("Organisation 'onenexium' not found. Create org first.");

  const all = [...ACCOUNTS, ...LEGACY];

  console.log("Ensuring primary role accounts...\n");
  for (const a of all) {
    const passwordHash = await bcrypt.hash(a.password, 12);
    const user = await prisma.user.upsert({
      where: { email: a.email },
      create: { email: a.email, name: a.name, passwordHash },
      update: { name: a.name, passwordHash, deletedAt: null },
    });
    await prisma.organisationMember.upsert({
      where: { organisationId_userId: { organisationId: org.id, userId: user.id } },
      create: {
        organisationId: org.id,
        userId: user.id,
        role: a.role,
        department: a.dept,
        status: "ACTIVE",
      },
      update: { role: a.role, department: a.dept, status: "ACTIVE" },
    });
    console.log(`  OK  ${a.email.padEnd(28)} ${a.role.padEnd(18)} pwd=${a.password}`);
  }

  console.log("\nPrimary logins:");
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(18)} ${a.email} / ${a.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
