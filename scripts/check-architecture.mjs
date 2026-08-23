import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const goCache = path.join(root, "build", "go-cache");
await mkdir(goCache, { recursive: true });

const child = spawn(
  "clean-code",
  [
    "architecture",
    "-policy",
    "config/architecture.policy.json",
    "-graph",
    "build/dependency-graph.json",
  ],
  {
    cwd: root,
    env: { ...process.env, GOCACHE: goCache },
    shell: false,
    stdio: "inherit",
  },
);

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal !== null) {
      reject(new Error(`architecture check stopped by signal ${signal}`));
      return;
    }
    resolve(code ?? 1);
  });
});

if (exitCode !== 0) process.exitCode = exitCode;
