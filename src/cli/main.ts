#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { ContentEvaluationError, DEFAULT_MAX_CONTENT_BYTES } from "../domain/index.js";
import { runCli, type CliIo } from "./run.js";

const processIo: CliIo = {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  readStdin: async () => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      bytes += buffer.length;
      if (bytes > DEFAULT_MAX_CONTENT_BYTES) {
        throw new ContentEvaluationError(
          `stdin exceeds the ${DEFAULT_MAX_CONTENT_BYTES} byte content limit`,
        );
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString("utf8");
  },
};

runCli(process.argv.slice(2), processIo).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  },
);
