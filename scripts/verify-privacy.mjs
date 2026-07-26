import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { createApp } from "@parallel/api";
import { createTwinEngineFromEnv } from "@parallel/twin-engine";
import { ExaEvidenceProvider } from "@parallel/twin-engine/providers/exa";
import { PrecedentStore } from "../apps/desktop/electron/precedents.ts";

const secretCropText = "private-student-crop-7f33";
const cropBytes = new TextEncoder().encode(secretCropText);
const form = new FormData();
form.set(
  "crop",
  new File([cropBytes.buffer], "crop.png", { type: "image/png" }),
);
form.set("coursePackId", "statics-2d-v1");
const response = await createApp({
  engine: createTwinEngineFromEnv({ PARALLEL_DEMO_MODE: "1" }),
}).request("/v1/twins", {
  method: "POST",
  body: form,
});
const streamBody = await response.text();

let exaBody = "";
await new ExaEvidenceProvider("verification-key", async (_url, init) => {
  exaBody = String(init?.body);
  return new Response(JSON.stringify({ results: [] }), { status: 200 });
}).search({
  query:
    "introductory 2D statics worked example moment about point counter-clockwise positive",
});

const recognizedLine = streamBody
  .split("\n")
  .find((line) => line.startsWith("data:") && line.includes('"recognized"'));
const completeLine = streamBody
  .split("\n")
  .find((line) => line.startsWith("data:") && line.includes('"complete"'));
if (!recognizedLine || !completeLine) {
  console.error("privacy_scan status=failed");
  process.exit(1);
}
const signature = JSON.parse(recognizedLine.slice(5)).signature;
const twin = JSON.parse(completeLine.slice(5)).twin;

const directory = mkdtempSync(join(tmpdir(), "parallel-privacy-"));
const databasePath = join(directory, "privacy.sqlite");
try {
  const store = new PrecedentStore(databasePath);
  store.savePrecedent({
    signature,
    twin,
    outcome: "unlocked",
    cropDataUrl: secretCropText,
    rawOcr: "private raw OCR",
  });
  store.close();

  const database = new Database(databasePath, { readonly: true });
  const columns = database
    .prepare("PRAGMA table_info(precedents)")
    .all()
    .map((column) => column.name);
  const storedRows = JSON.stringify(
    database.prepare("SELECT * FROM precedents").all(),
  );
  database.close();

  const prohibitedFields = /original(?:_|)answer/i.test(streamBody) ? 1 : 0;
  const cropEchoes = streamBody.includes(secretCropText) ? 1 : 0;
  const exaRawLeaks = exaBody.includes(secretCropText) ? 1 : 0;
  const sqliteRawColumns = columns.filter((column) =>
    /crop|screenshot|ocr|student/i.test(column),
  ).length;
  const sqliteRawValues =
    storedRows.includes(secretCropText) || storedRows.includes("private raw OCR")
      ? 1
      : 0;
  const total =
    prohibitedFields +
    cropEchoes +
    exaRawLeaks +
    sqliteRawColumns +
    sqliteRawValues;

  console.log(
    `privacy_scan prohibited_fields=${prohibitedFields} crop_echoes=${cropEchoes} exa_raw_leaks=${exaRawLeaks} sqlite_raw_columns=${sqliteRawColumns} sqlite_raw_values=${sqliteRawValues}`,
  );
  if (total !== 0) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
