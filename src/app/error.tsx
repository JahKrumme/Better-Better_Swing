"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel" role="alert">
      <h1 className="text-2xl font-bold">Your dashboard couldn’t load</h1>
      <p className="my-4">
        Try again in a moment. If this continues, restart the local app with
        pnpm app:start. Your saved records are preserved.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
