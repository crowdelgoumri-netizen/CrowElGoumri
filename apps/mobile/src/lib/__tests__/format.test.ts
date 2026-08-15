/**
 * Sample test — proves the jest-expo harness runs (@crowdshipping/mobile had
 * zero tests before this). Targets the pure formatting utils so it needs no
 * component provider (NativeWind / expo-router) setup; React Native Testing
 * Library is installed for component tests that follow.
 *
 * Run with: pnpm --filter @crowdshipping/mobile test
 */
import { describe, it, expect } from "@jest/globals";
import { eur, money, initials, cityOf } from "../format";

describe("format", () => {
  it("eur formats EUR in fr-FR", () => {
    // Match on digits + currency glyph: the exact spacing is a no-break char
    // that varies across ICU versions, so an exact-equal assertion is brittle.
    const s = eur(12.5);
    expect(s).toMatch(/12,50/);
    expect(s).toMatch(/€/);
  });

  it("eur returns — for null/undefined/NaN", () => {
    expect(eur(null)).toBe("—");
    expect(eur(undefined)).toBe("—");
    expect(eur(NaN)).toBe("—");
  });

  it("money routes DZD (no decimals) vs EUR", () => {
    expect(money(100, "EUR")).toBe(eur(100));
    expect(money(100, "DZD")).toMatch(/100/);
    expect(money(100, "DZD")).toMatch(/DZD/);
  });

  it("initials takes the first letters of the first two words", () => {
    expect(initials("Ahcene Bouzid")).toBe("AB");
    expect(initials("Solo")).toBe("S");
    expect(initials(undefined)).toBe("?");
  });

  it("cityOf prefers city over wilaya/label/country", () => {
    expect(cityOf({ city: "Lyon", wilaya: "Alger", country: "FR" })).toBe("Lyon");
    expect(cityOf({ wilaya: "Oran" })).toBe("Oran");
    expect(cityOf(null)).toBe("—");
    expect(cityOf()).toBe("—");
  });
});
