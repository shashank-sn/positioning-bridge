import { describe, expect, it } from "vitest";
import { CliUsageError, parseArguments } from "../../src/cli/arguments.js";

describe("CLI arguments", () => {
  it("uses the configured pack environment fallback", () => {
    expect(
      parseArguments(["validate"], { POSITIONING_BRIDGE_PACK: "company.yaml" }),
    ).toEqual({
      name: "validate",
      pack: "company.yaml",
      format: "human",
    });
  });

  it("requires one content source and explicit context", () => {
    expect(() =>
      parseArguments([
        "check",
        "--pack",
        "pack.yaml",
        "--audience",
        "buyer",
        "--channel",
        "web",
        "--funnel-stage",
        "consideration",
      ]),
    ).toThrow(CliUsageError);
  });

  it("rejects duplicate and unknown options", () => {
    expect(() => parseArguments(["validate", "--pack", "a", "--pack", "b"])).toThrow(
      /duplicate option/,
    );
    expect(() => parseArguments(["validate", "--pack", "a", "--wat", "b"])).toThrow(
      /unknown option/,
    );
  });
});
