import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Lighthouse de push espera o commit chegar à produção", async () => {
  const workflow = await readFile(
    ".github/workflows/lighthouse-quality.yml",
    "utf8"
  );

  assert.match(workflow, /Aguardar produção deste commit/);
  assert.match(workflow, /version\.json/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.match(workflow, /if: github\.event_name == 'push'/);
});
