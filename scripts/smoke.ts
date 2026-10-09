import assert from "node:assert/strict";
import { loadData } from "../src/db/queries";
import { pool } from "../src/db";
import { evaluateOfferEligibility } from "../src/domain/eligibility";
try {
  const data = await loadData();
  const fixtures = data.offers.filter((o) => o.fixture);
  assert.equal(fixtures.length, 5);
  const expected = new Map([
    ["$10 no-deposit signup bonus", true],
    ["Deposit $10, receive $100", false],
    ["Bet $5, receive $150", false],
    ["Free daily promotional coin", true],
    ["Paid membership reward", false],
  ]);
  for (const o of fixtures) {
    const result = evaluateOfferEligibility(o, {
      country: "US",
      state: "KS",
      age: 25,
      excludedPlatforms: ["Fliff"],
    });
    assert.equal(result.eligible, expected.get(o.title), o.title);
    assert.equal(o.evidence.length, 10, `Evidence count: ${o.title}`);
  }
  assert.equal(data.claims.length, 0);
  assert.equal(data.redemptions.length, 0);
  console.log(
    "Database smoke passed: 5 fixtures, 50 evidence records, 2 free / 3 rejected for known eligible age, no fabricated earnings.",
  );
} finally {
  await pool.end();
}
