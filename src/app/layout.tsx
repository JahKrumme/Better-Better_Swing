import Link from "next/link";
import "./globals.css";
export const metadata = {
  title: "Free Money Finder",
  description: "Your free rewards and balances in one place",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-green-900/15 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="text-xl font-bold tracking-tight">
                Free Money Finder{" "}
                <span className="ml-2 text-xs font-normal muted">
                  PERSONAL USE
                </span>
              </Link>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm">
                $0 out of pocket · Always
              </span>
            </div>
            <nav
              aria-label="Main"
              className="mt-6 flex flex-wrap gap-6 text-sm font-semibold"
            >
              {[
                ["/", "HOME"],
                ["/casinos", "CASINOS"],
                ["/sportsbook", "SPORTSBOOKS"],
                ["/history", "HISTORY"],
                ["/advanced", "ADVANCED"],
              ].map(([href, name]) => (
                <Link key={href} href={href} className="hover:underline">
                  {name}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
        <footer className="mx-auto max-w-7xl px-5 py-8 text-sm muted">
          Free promotional currency is not cash. Local use · Central time.
        </footer>
      </body>
    </html>
  );
}
