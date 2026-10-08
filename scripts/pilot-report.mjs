import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPilotFeedbackReport } from "../src/evaluation/feedback-report.ts";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || resolve(inputPath) === resolve(outputPath)) {
  console.error("Usage: node --experimental-strip-types scripts/pilot-report.mjs <consented-workspace.json> <new-report.json>");
  process.exitCode = 1;
} else {
  const snapshot = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const report = buildPilotFeedbackReport(snapshot);
  // Refuse to overwrite an existing report or any source data.
  await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, {flag:"wx"});
  console.log(`Saved aggregate report to ${resolve(outputPath)}. Human physics review: not performed.`);
}
