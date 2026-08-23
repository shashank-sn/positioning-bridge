import { readFile, writeFile } from "node:fs/promises";
import { positioningPackJsonSchema } from "../dist/config/index.js";

const outputPath = new URL("../schemas/positioning-pack.schema.json", import.meta.url);
const output = `${JSON.stringify(positioningPackJsonSchema, null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    process.stderr.write("positioning pack JSON Schema has not been generated\n");
    process.exitCode = 1;
  }
  if (current !== output) {
    process.stderr.write(
      "positioning pack JSON Schema is stale; run npm run schema:generate\n",
    );
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, output, "utf8");
  process.stdout.write("generated schemas/positioning-pack.schema.json\n");
}
