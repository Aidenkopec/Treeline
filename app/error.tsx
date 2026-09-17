"use client";

import { SiteFooter } from "@/components/site-footer";

/**
 * SPEC §8 wants the disclaimer here too. `SiteFooter` renders inside this client
 * boundary only while it stays a server component with no server-only imports.
 */
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-24">
        <h1 className="u-massif text-2xl text-snow">Something went wrong</h1>
        <p className="mt-4 max-w-[52ch] text-sm text-rock">
          This page stopped rendering. The run table and the numbers on it are served with the
          document, so reloading usually brings them back.
        </p>
        <button
          className="u-data mt-6 w-fit transition-colors hover:text-snow"
          onClick={retry}
          type="button"
        >
          ← Try again
        </button>
      </div>
      <SiteFooter />
    </main>
  );
}
