"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const db = /ECONNREFUSED|Server selection timeout|No available servers|P1001|P2010/i.test(error.message);
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="card max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto text-warn" size={34} />
        <h2 className="mt-2 text-[16px] font-bold">{db ? "Can't reach the database" : "Something went wrong"}</h2>
        <p className="mt-1 text-[13px] text-muted">
          {db ? (
            <>
              MongoDB isn&apos;t responding. Start the app with <code className="rounded bg-surface px-1">npm run dev</code> (it launches the local database), or check <code className="rounded bg-surface px-1">DATABASE_URL</code> in .env.
            </>
          ) : (
            "The page failed to load. Try again — if it keeps happening, reload the app."
          )}
        </p>
        <button className="btn btn-primary mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
