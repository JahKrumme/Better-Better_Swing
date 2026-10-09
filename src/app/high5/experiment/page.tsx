import Link from "next/link";
import { loadHigh5 } from "@/db/high5-service";
import { High5Performance, High5Today } from "../display";
export const dynamic = "force-dynamic";
export default async function Experiment() {
  const d = await loadHigh5();
  return (
    <>
      <h1 className="text-3xl font-bold">HIGH 5 EXPERIMENT · REAL</h1>
      <p className="my-4 muted">
        Measure whether manually collecting free rewards and using only free
        currency produces meaningful redeemable value. No guaranteed profit,
        deposits or purchased bankroll.
      </p>
      {d ? <High5Performance data={d} /> : <High5Today data={null} />}
      <Link href="/high5" className="underline">
        Record a reward, play or redemption
      </Link>
    </>
  );
}
