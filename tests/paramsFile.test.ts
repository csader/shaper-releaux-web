import { describe, expect, it } from "vitest";
import { parseParamsFile, serializeParamsFile } from "../src/params/paramsFile";

describe("serializeParamsFile / parseParamsFile", () => {
  it("round-trips a set of fields through serialize then parse", () => {
    const fields = [
      { label: "Width", value: 58 },
      { label: "Profile", value: "concave" },
      { label: "Flip Side", value: false },
    ];
    const text = serializeParamsFile("Chord", fields);
    const parsed = parseParamsFile(text);
    expect(parsed["Width"]).toBe("58");
    expect(parsed["Profile"]).toBe("concave");
    expect(parsed["Flip Side"]).toBe("false");
  });

  it("includes a header comment naming the tool and re-upload instructions", () => {
    const text = serializeParamsFile("Chord", [{ label: "Width", value: 58 }]);
    expect(text).toContain("# Chord parameters");
    expect(text).toContain("Re-upload this file in the Chord tool");
  });

  it("ignores blank lines and comment lines when parsing", () => {
    const text = "# a comment\n\nWidth: 58\n\n# another comment\nDepth: 9.5\n";
    expect(parseParamsFile(text)).toEqual({ Width: "58", Depth: "9.5" });
  });

  it("handles values that themselves contain a colon", () => {
    const text = "Note: ratio 2:1\n";
    expect(parseParamsFile(text)).toEqual({ Note: "ratio 2:1" });
  });

  it("returns an empty object for text with no valid lines", () => {
    expect(parseParamsFile("# just a comment\n\n")).toEqual({});
  });
});
