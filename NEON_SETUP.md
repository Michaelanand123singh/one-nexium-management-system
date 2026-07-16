# Neon database setup

## 1. Finish `neonctl init` (if you started it)

If you ran `npx neonctl@latest init` and it’s waiting in the terminal:

1. Use **Space** to select **Cursor** (and any other editors you want).
2. Press **Enter** to confirm.
3. Wait until it reports “Agent skills installed” and “What’s next”.

This logs you in and installs Neon tooling (MCP, extension, skills). You only need to do it once.

---

## 2. Create a Neon project and get the connection string

**Option A – Neon Console (recommended)**

1. Open [Neon Console](https://console.neon.tech).
2. Sign in (or create an account).
3. Create a project (e.g. `onenexium-management`).
4. Open the project → **Connection details** (or **Dashboard**).
5. Copy the **connection string** (choose “Pooled” if you use serverless/Prisma).
6. For Prisma, the URL should look like:
   ```txt
   postgresql://USER:PASSWORD@ep-XXX-XXX.pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

**Option B – Neon CLI**

After you’ve run `neonctl init` (and are logged in), in your project root run:

```bash
npx neonctl@latest projects create
```

- Choose your **organization** (arrow keys + Enter).
- Optionally set a project name when prompted.
- The CLI will print a **connection string**; use that as `DATABASE_URL`.

To get a **Prisma-style** connection string for an existing project:

```bash
npx neonctl@latest connection-string --prisma
```

Use `--project-id <id>` if you have more than one project.

---

## 3. Configure the app

1. Copy the env example and add your Neon URL:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
   ```

   Paste the connection string you got from the Console or CLI.

3. Push the schema and seed (from project root):

   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

You can log in with the seed user (see README).

---

## Non-interactive init (Cursor only)

To run init without the editor selection prompt:

```bash
npx neonctl@latest init --agent cursor
```

You’ll still need to complete browser auth if it’s your first time.
