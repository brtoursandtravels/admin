import { describe, expect, it } from "vitest";
import { parseMenuLines } from "./lib/navigation";

describe("admin navigation input", () => {
  it("preserves a stable two-level client relationship", () => {
    expect(
      parseMenuLines(
        "tours||Tours|/packages|0|true\ndomestic|tours|Domestic|/packages?category=domestic|1|true",
      ),
    ).toEqual([
      {
        key: "tours",
        parentKey: null,
        label: "Tours",
        href: "/packages",
        sortOrder: 0,
        isVisible: true,
      },
      {
        key: "domestic",
        parentKey: "tours",
        label: "Domestic",
        href: "/packages?category=domestic",
        sortOrder: 1,
        isVisible: true,
      },
    ]);
  });

  it("rejects incomplete menu rows before sending a mutation", () => {
    expect(() => parseMenuLines("missing-fields")).toThrow("line 1");
  });
});
