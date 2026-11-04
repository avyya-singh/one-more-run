import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../scripts/evaluate-telemetry.js";
import { DIM } from "../src/model.js";
test("offline evaluation uses a chronological held-out split and reports baseline", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    features: Array.from({ length: DIM }, (_, j) => (j === 0 ? 1 : 0)),
    actual: i < 70 ? 0 : 1,
  }));
  const copy = JSON.stringify(rows);
  const report = evaluate(rows);
  assert.equal(report.trainSamples, 70);
  assert.equal(report.testSamples, 30);
  assert.equal(report.accuracy, 0);
  assert.equal(report.majorityBaselineAccuracy, 0);
  assert.equal(report.confusionMatrix.values[1][0], 30);
  assert.equal(JSON.stringify(rows), copy);
  assert.throws(() => evaluate(rows.slice(0, 10)));
});
