import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

async function readDoc(relativePath: string): Promise<string> {
  const full = path.join(process.cwd(), relativePath);
  return fs.readFile(full, "utf8");
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [hld, lld] = await Promise.all([
      readDoc("docs/architecture/ONENEXIUM_HLD_V2.md"),
      readDoc("docs/architecture/ONENEXIUM_LLD.md"),
    ]);
    return NextResponse.json({ hld, lld });
  } catch (e) {
    console.error("[architecture] failed to load docs:", e);
    return NextResponse.json(
      { error: "Architecture docs not found" },
      { status: 500 }
    );
  }
}
