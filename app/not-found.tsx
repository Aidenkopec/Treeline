import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

/**
 * Explicit because the footer is no longer in the root layout, and SPEC §8
 * wants the disclaimer on every page — including the one a stale resort link
 * lands on.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-24">
        <h1 className="u-massif text-2xl text-snow">Not found</h1>
        <p className="mt-4 max-w-[52ch] text-sm text-rock">
          There is no page here. The resorts Treeline covers are listed on the home page.
        </p>
        <Link className="u-data mt-6 w-fit transition-colors hover:text-snow" href="/">
          ← Treeline
        </Link>
      </div>
      <SiteFooter />
    </main>
  );
}
