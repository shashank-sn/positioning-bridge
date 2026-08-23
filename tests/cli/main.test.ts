import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { describe, expect, it } from "vitest";
import { runCli, type CliIo } from "../../src/cli/run.js";
import { validPack } from "../fixtures/pack.js";

function capture(stdin = ""): {
  readonly io: CliIo;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
      readStdin: () => Promise.resolve(stdin),
    },
  };
}

async function fixtureFiles(): Promise<{
  readonly directory: string;
  readonly pack: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), "positioning-bridge-test-"));
  const pack = join(directory, "positioning.yaml");
  await writeFile(pack, stringify(validPack), "utf8");
  return { directory, pack };
}

describe("CLI", () => {
  it("initializes a valid starter pack without overwriting", async () => {
    const { directory } = await fixtureFiles();
    const output = join(directory, "starter.yaml");
    const first = capture();
    const second = capture();

    expect(await runCli(["init", "--output", output], first.io, {})).toBe(0);
    expect(await runCli(["validate", "--pack", output], first.io, {})).toBe(0);
    expect(await readFile(output, "utf8")).toContain('schemaVersion: "1"');
    expect(await runCli(["init", "--output", output], second.io, {})).toBe(2);
    expect(second.stderr.join("\n")).toContain("EEXIST");
  });

  it("validates a pack and emits machine-readable check output", async () => {
    const { pack } = await fixtureFiles();
    const validation = capture();
    const checked = capture(
      "The current positioning policy stays under company control.",
    );

    expect(await runCli(["validate", "--pack", pack], validation.io, {})).toBe(0);
    expect(validation.stdout[0]).toContain("valid: Acme positioning");
    expect(
      await runCli(
        [
          "check",
          "--pack",
          pack,
          "--stdin",
          "--audience",
          "platform-leader",
          "--channel",
          "landing-page",
          "--funnel-stage",
          "consideration",
          "--semantic",
          "disabled",
          "--json",
        ],
        checked.io,
        {},
      ),
    ).toBe(0);
    expect(JSON.parse(checked.stdout[0] ?? "{}")).toMatchObject({
      decision: "pass",
      capabilities: { semantic: "not_run" },
    });

    const jsonValidation = capture();
    expect(
      await runCli(["validate", "--pack", pack, "--json"], jsonValidation.io, {}),
    ).toBe(0);
    expect(JSON.parse(jsonValidation.stdout[0] ?? "{}")).toMatchObject({
      id: "acme-positioning",
    });
  });

  it("checks a content file with an explicit campaign", async () => {
    const { directory, pack } = await fixtureFiles();
    const content = join(directory, "draft.md");
    await writeFile(
      content,
      "The current positioning policy stays under company control.",
      "utf8",
    );
    const checked = capture();

    expect(
      await runCli(
        [
          "check",
          "--pack",
          pack,
          "--content",
          content,
          "--audience",
          "platform-leader",
          "--channel",
          "landing-page",
          "--funnel-stage",
          "consideration",
          "--campaign",
          "campaign.launch",
          "--semantic",
          "disabled",
          "--json",
        ],
        checked.io,
        {},
      ),
    ).toBe(0);
    expect(JSON.parse(checked.stdout[0] ?? "{}")).toMatchObject({
      context: { campaignId: "campaign.launch" },
    });
  });

  it("reports path-specific pack, content, size, and context failures", async () => {
    const { directory, pack } = await fixtureFiles();
    const invalidPack = join(directory, "invalid.json");
    const oversized = join(directory, "oversized.md");
    const contentDirectory = join(directory, "content-directory");
    await writeFile(invalidPack, '{"schemaVersion":"1"}', "utf8");
    await writeFile(oversized, "x".repeat(200_001), "utf8");
    await mkdir(contentDirectory);

    const packFailure = capture();
    expect(await runCli(["validate", "--pack", invalidPack], packFailure.io, {})).toBe(
      2,
    );
    expect(packFailure.stderr[0]).toContain(
      "positioning pack failed schema validation",
    );
    expect(packFailure.stderr[0]).toContain("- name:");

    for (const [path, message] of [
      [contentDirectory, "content path is not a file"],
      [oversized, "200001 bytes; the limit is 200000 bytes"],
    ] as const) {
      const failure = capture();
      expect(
        await runCli(
          [
            "check",
            "--pack",
            pack,
            "--content",
            path,
            "--audience",
            "platform-leader",
            "--channel",
            "landing-page",
            "--funnel-stage",
            "consideration",
          ],
          failure.io,
          {},
        ),
      ).toBe(2);
      expect(failure.stderr[0]).toContain(message);
    }

    const badContext = capture(
      "The current positioning policy stays under company control.",
    );
    expect(
      await runCli(
        [
          "check",
          "--pack",
          pack,
          "--stdin",
          "--audience",
          "platform-leader",
          "--channel",
          "missing-channel",
          "--funnel-stage",
          "consideration",
        ],
        badContext.io,
        {},
      ),
    ).toBe(2);
    expect(badContext.stderr[0]).toContain("unknown channelId");
  });

  it("uses exit 1 for blocked content and exit 2 for usage errors", async () => {
    const { pack } = await fixtureFiles();
    const blocked = capture("It trains on customer content.");
    const usage = capture();

    expect(
      await runCli(
        [
          "check",
          "--pack",
          pack,
          "--stdin",
          "--audience",
          "platform-leader",
          "--channel",
          "landing-page",
          "--funnel-stage",
          "consideration",
        ],
        blocked.io,
        {},
      ),
    ).toBe(1);
    expect(blocked.stdout[0]).toContain("blocked:");
    expect(await runCli(["validate"], usage.io, {})).toBe(2);
    expect(usage.stderr[0]).toContain("missing required option '--pack'");
  });

  it("prints help and version without reading files", async () => {
    const output = capture();
    expect(await runCli(["--help"], output.io, {})).toBe(0);
    expect(await runCli(["--version"], output.io, {})).toBe(0);
    expect(output.stdout.join("\n")).toContain("positioning-bridge 0.1.0");
  });
});
