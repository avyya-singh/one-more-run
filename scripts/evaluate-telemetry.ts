import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MoveModel, DIM, ACTIONS } from "../src/model.js";
type Row = { features: number[]; actual: number };
export function evaluate(rows: Row[], epochs = 20) {
  if (rows.length < 30)
    throw Error("Export at least 30 movement samples first.");
  if (
    !rows.every(
      (r) =>
        r.features?.length === DIM &&
        r.features.every(Number.isFinite) &&
        Number.isInteger(r.actual) &&
        r.actual >= 0 &&
        r.actual < 5,
    )
  )
    throw Error("Telemetry has invalid features or action labels.");
  const cut = Math.floor(rows.length * 0.7),
    train = rows.slice(0, cut),
    test = rows.slice(cut);
  const m = new MoveModel();
  for (let e = 0; e < epochs; e++)
    for (const row of train) m.train(row.features, row.actual);
  const count = [0, 0, 0, 0, 0];
  train.forEach((r) => count[r.actual]++);
  const baseline = count.indexOf(Math.max(...count));
  let correct = 0,
    baseCorrect = 0,
    loss = 0;
  const confusion = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const row of test) {
    const p = m.predict(row.features);
    if (p.action === row.actual) correct++;
    if (baseline === row.actual) baseCorrect++;
    loss -= Math.log(Math.max(1e-9, p.probs[row.actual]));
    confusion[row.actual][p.action]++;
  }
  return {
    split:
      "Chronological 70% train / 30% held-out test; test samples never train the model.",
    samples: rows.length,
    trainSamples: train.length,
    testSamples: test.length,
    epochs,
    accuracy: correct / test.length,
    majorityBaselineAccuracy: baseCorrect / test.length,
    meanCrossEntropy: loss / test.length,
    confusionMatrix: {
      rows: "actual",
      columns: "predicted",
      labels: ACTIONS,
      values: confusion,
    },
    note: "Personal gameplay is autocorrelated and class-imbalanced. These results are not evidence of general player modelling or causal improvements in rival difficulty.",
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const filename = process.argv[2];
    if (!filename)
      throw Error(
        "Usage: npm run evaluate -- path/to/one-more-run-telemetry.json",
      );
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    if (!Array.isArray(data.rounds))
      throw Error("Expected an exported telemetry file.");
    const rows = data.rounds.flatMap(
      (r: { samples: Row[] }) => r.samples || [],
    );
    console.log(JSON.stringify(evaluate(rows), null, 2));
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}
