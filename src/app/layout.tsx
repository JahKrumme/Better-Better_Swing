import Link from "next/link";
import "./globals.css";
export const metadata = {
  title: "Free Money Finder",
  description: "Evidence-first personal promotional reward research",
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
                  PERSONAL RESEARCH
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
                ["/", "Today"],
                ["/high5", "High 5"],
                ["/overview", "Overview"],
                ["/casinos", "Casinos"],
                ["/sportsbook", "Sports betting"],
                ["/bankroll", "Bankroll"],
                ["/demo", "Simulation"],
                ["/offers", "Offers"],
                ["/platforms", "Platforms"],
                ["/earnings", "Earnings"],
                ["/claims", "Manual claims"],
                ["/research", "Admin / Research"],
              ].map(([href, name]) => (
                <Link key={href} href={href} className="hover:underline">
                  {name}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8">
          <aside className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <strong>Evidence first.</strong> Only current primary evidence can
            establish a real $0 opportunity. Promotional currency is not cash.
            Claims are manual; fictional fixtures are available separately.
          </aside>
          {children}
        </main>
        <footer className="mx-auto max-w-7xl px-5 py-8 text-sm muted">
          Unknown terms stay unverified. Fliff is excluded. Local use only.
        </footer>
      </body>
    </html>
  );
}
