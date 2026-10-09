"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel" role="alert">
      <h1 className="text-2xl font-bold">Unable to load research data</h1>
      <p className="my-4">
        Check that PostgreSQL is running and DATABASE_URL is configured. Run
        migrations before opening the dashboard. Your saved records have not
        been changed.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
