import { pool } from "@/db";
import { runtimeStatus } from "@/domain/product";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await pool.query("SELECT 1");
    const state = await pool.query(
      'SELECT enabled, "heartbeatAt", "lastRunAt", "nextRunAt" FROM local_runtime WHERE key=\'runner\'',
    );
    return Response.json({
      ok: true,
      background: runtimeStatus(state.rows[0]).on,
    });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
