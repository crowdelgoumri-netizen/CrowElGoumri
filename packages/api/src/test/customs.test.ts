/**
 * Customs compliance engine tests.
 * Run with: pnpm --filter @crowdshipping/api test
 *
 * Pure logic — no DB, no Fastify. Locks the prohibited-block vs warn-only
 * contract and the EUR thresholds derived from the DZD franchise.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateParcelCustoms } from "../lib/customs.js";

describe("customs: prohibited items (hard block)", () => {
  it("blocks a drone in subCategory", () => {
    const r = validateParcelCustoms({
      category: "Electronics",
      subCategory: "Drone DJI",
      description: "Cadeau pour mon frère",
      estimatedValue: 400,
    });
    assert.equal(r.blocked, true);
    assert.ok(r.violations.some((v) => v.rule === "drones"));
  });

  it("blocks a weapon mentioned in the description (accent/case insensitive)", () => {
    const r = validateParcelCustoms({
      category: "Other",
      description: "Petite ARME pour la collection, sans munitions",
      estimatedValue: 50,
    });
    assert.equal(r.blocked, true);
    assert.ok(r.violations.some((v) => v.rule === "weapons"));
  });

  it("blocks narcotics keywords (normalized diacritics)", () => {
    const r = validateParcelCustoms({
      category: "Medicine",
      description: "STUPEFIANTS pour usage perso",
      estimatedValue: 10,
    });
    assert.equal(r.blocked, true);
    assert.ok(r.violations.some((v) => v.rule === "narcotics"));
  });

  it("does NOT block on a mid-word false positive (alarme ≠ arme)", () => {
    const r = validateParcelCustoms({
      category: "Electronics",
      description: "Alarme incendie maison",
      estimatedValue: 30,
    });
    assert.equal(r.blocked, false);
  });

  it("does NOT block on a benign GPS mention", () => {
    // Bare "gps" must not fire — only high-precision/offline GPS phrases do.
    const r = validateParcelCustoms({
      category: "Electronics",
      description: "Montre GPS connectée pour le sport",
      estimatedValue: 90,
    });
    assert.equal(r.blocked, false);
  });
});

describe("customs: declaration-required + franchise (warn only)", () => {
  it("flags electronics > 300 EUR", () => {
    const r = validateParcelCustoms({
      category: "Electronics",
      description: "Ordinateur portable pour études",
      estimatedValue: 350,
    });
    assert.equal(r.blocked, false);
    assert.equal(r.requiresDeclaration, true);
    assert.ok(r.warnings.some((w) => w.includes("300 EUR")));
  });

  it("warns that medicine needs a prescription", () => {
    const r = validateParcelCustoms({
      category: "Medicine",
      description: "Traitement mensuel",
      estimatedValue: 20,
    });
    assert.equal(r.blocked, false);
    assert.equal(r.requiresDeclaration, true);
    assert.ok(r.warnings.some((w) => w.includes("ordonnance")));
  });

  it("warns on cosmetics", () => {
    const r = validateParcelCustoms({
      category: "Cosmetics",
      description: "Parfums cadeaux",
      estimatedValue: 40,
    });
    assert.equal(r.requiresDeclaration, true);
    assert.ok(r.warnings.some((w) => w.includes("cosmétiques")));
  });

  it("flags any category over the franchise ceiling (≈120 EUR)", () => {
    const r = validateParcelCustoms({
      category: "Documents",
      description: "Matériel professionnel",
      estimatedValue: 150,
    });
    assert.equal(r.requiresDeclaration, true);
    assert.ok(r.warnings.some((w) => w.includes("franchise voyageur")));
  });

  it("stacks multiple warnings (cosmetics + franchise)", () => {
    const r = validateParcelCustoms({
      category: "Cosmetics",
      description: "Coffret parfums",
      estimatedValue: 200,
    });
    assert.ok(r.warnings.length >= 2);
  });
});

describe("customs: clean parcels", () => {
  it("passes a cheap, benign electronics parcel with no warnings", () => {
    const r = validateParcelCustoms({
      category: "Electronics",
      description: "Chargeur de téléphone",
      estimatedValue: 25,
    });
    assert.equal(r.blocked, false);
    assert.equal(r.requiresDeclaration, false);
    assert.equal(r.warnings.length, 0);
  });
});

console.log("customs tests: done");
