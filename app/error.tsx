"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Server Components / render error:", error.message || error.digest, error);
  }, [error]);

  const msg = typeof error.message === "string" ? error.message : "";
  /**
   * Only suggest migrations when the error actually looks like DB/schema drift.
   * Previously: any production error showed "run migrate" because of `production || isLikelySchemaMismatch`,
   * and `isLikelySchemaMismatch` matched almost any Prisma error — both were misleading.
   */
  const isLikelySchemaMismatch =
    msg.length > 0 &&
    (/\bP20(21|10|22|23)\b/.test(msg) ||
      /does not exist in the current database/i.test(msg) ||
      /column .+ does not exist/i.test(msg) ||
      /relation .+ does not exist/i.test(msg) ||
      /Unknown column/i.test(msg) ||
      /no such column/i.test(msg) ||
      /must be migrated/i.test(msg) ||
      /Migration.*failed/i.test(msg));

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      {(process.env.NODE_ENV === "development" || isLikelySchemaMismatch) && msg && (
        <pre className="max-w-full overflow-auto rounded bg-muted p-3 text-sm text-destructive">
          {msg}
        </pre>
      )}
      {isLikelySchemaMismatch ? (
        <>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            The database schema may be out of date. Run migrations, then try again.
          </p>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Run: <code className="rounded bg-muted px-1 py-0.5">npx prisma migrate deploy</code> (or{" "}
            <code className="rounded bg-muted px-1 py-0.5">npm run db:migrate:deploy</code>), then reload.
          </p>
        </>
      ) : (
        <p className="max-w-md text-center text-sm text-muted-foreground">
          Try again, or refresh the page. If this keeps happening, check server logs or contact your admin.
        </p>
      )}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
