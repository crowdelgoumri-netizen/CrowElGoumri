/**
 * Customs compliance engine — blueprint §4.1 (Algerian customs rules).
 *
 * Deterministic, rule-based. Two concerns:
 *   1. PROHIBITED items → hard block. The parcel must not enter the marketplace.
 *   2. DECLARATION-required / over-franchise → warn + set requiresDeclaration.
 *
 * validateParcelCustoms() is the single entry point, called at POST /parcels.
 * Pure: no AI (image classification is §4.1.3 step 4, deferred to an ML
 * service), no DB, no side effects — so it's trivially unit-testable and can
 * run synchronously inside the request path.
 *
 * EUR thresholds derive from the DZD franchise voyageur at the official rate
 * (blueprint §4.1.1): 30 000 DZD ≈ 120 EUR total ceiling, electronics > 300 EUR.
 * The blueprint's parallel-rate discrepancy doesn't change the EUR thresholds.
 *
 * Matching is accent- and case-insensitive (NFD + lowercase), on a word-start
 * boundary so plurals ("drones") match the singular keyword while mid-word
 * occurrences ("alarme") do not. The list errs toward flagging — the safe side
 * for a customs gate; tune the keywords if a benign term over-matches.
 */

export interface CustomsValidationInput {
  category: string;
  subCategory?: string | null;
  description?: string;
  /** Declared value in EUR (v1 is EUR-only on this corridor). */
  estimatedValue: number;
}

export interface CustomsViolation {
  /** The prohibited-rule id that matched, e.g. "drones". */
  rule: string;
  /** User-facing French message, with the legal basis where relevant. */
  message: string;
}

export interface CustomsValidationResult {
  /** True → reject the parcel at creation (400). */
  blocked: boolean;
  /** Prohibition messages (populated iff blocked). */
  violations: CustomsViolation[];
  /** Declaration/franchise messages (populated when not blocked). */
  warnings: string[];
  /** Set on the Parcel row so later flows know customs declaration is owed. */
  requiresDeclaration: boolean;
}

// ── Normalization + matching ─────────────────────────────────────────
// Strip combining diacritical marks so "Stupéfiants" / "STUPEFIANT" both
// normalize to "stupefiants", then lowercase. Keyword match is on a word-start
// boundary (\b) without an end boundary, so "drone" matches "drones"/"droner"
// but "arme" does not match inside "alarme" (no boundary before "arme").
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeyword(normalizedHaystack: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegex(normalize(keyword))}`).test(
    normalizedHaystack,
  );
}

// ── Prohibited (hard block) ──────────────────────────────────────────
// Blueprint §4.1.2. Matched against category + subCategory + description.
interface ProhibitedRule {
  id: string;
  message: string;
  keywords: string[];
}

const PROHIBITED: ProhibitedRule[] = [
  {
    id: "drones",
    message:
      "Les drones sont interdits à l'importation en Algérie (Arrêté ministériel 2015).",
    keywords: ["drone"],
  },
  {
    id: "weapons",
    message: "Les armes et munitions sont strictement interdites.",
    keywords: ["arme", "munition", "airsoft", "weapon", "pistolet", "fusil", "carabine"],
  },
  {
    id: "narcotics",
    message:
      "Les stupéfiants sont strictement interdits. Signalement automatique.",
    keywords: [
      "stupéfiant", "narcotique", "psychotrope",
      "cannabis", "cocaïne", "héroïne", "extasie", "mdma",
    ],
  },
  {
    id: "counterfeit",
    message:
      "Les contrefaçons sont interdites (droit algérien et international).",
    keywords: ["contrefaçon", "counterfeit", "réplique de marque", "faux marqu"],
  },
  {
    id: "alcohol",
    message: "L'alcool ne peut pas être transporté via CrowdShipping.",
    keywords: [
      "alcool", "alcohol", "spiritueux", "champagne",
      "whisky", "vodka", "rhum", "bière",
    ],
  },
  {
    id: "comms-gear",
    message: "Le matériel de communication non homologué est interdit.",
    keywords: ["walkie", "talkie-walkie", "radio non agré"],
  },
  {
    id: "satellite",
    message:
      "Les téléphones satellites et GPS haute précision sont interdits à l'importation.",
    keywords: [
      "téléphone satellite", "satellite phone", "satphone",
      "gps haute précision", "gps hors-ligne", "gps hors ligne",
    ],
  },
  {
    id: "israeli-origin",
    message: "Les produits israéliens sont interdits (loi algérienne).",
    keywords: ["produit israélien", "israeli product", "made in israel"],
  },
];

// ── Declaration / franchise thresholds (EUR) ─────────────────────────
const ELECTRONICS_DECL_THRESHOLD_EUR = 300; // blueprint §4.1.2 ⚠️ list
const FRANCHISE_TOTAL_THRESHOLD_EUR = 120; // ≈ 30 000 DZD official (§4.1.1)

function declarationWarnings(input: CustomsValidationInput): string[] {
  const warnings: string[] = [];
  const cat = normalize(input.category);

  if (cat === "electronics" && input.estimatedValue > ELECTRONICS_DECL_THRESHOLD_EUR) {
    warnings.push(
      "Les appareils électroniques > 300 EUR nécessitent une déclaration douanière spéciale.",
    );
  }
  if (cat === "medicine") {
    warnings.push(
      "Les médicaments nécessitent une ordonnance (max 3 mois de traitement).",
    );
  }
  if (cat === "cosmetics") {
    warnings.push("Maximum 5 produits cosmétiques sous franchise voyageur.");
  }
  if (input.estimatedValue > FRANCHISE_TOTAL_THRESHOLD_EUR) {
    warnings.push(
      "La valeur déclarée dépasse la franchise voyageur (≈ 30 000 DZD / 120 EUR) — des droits de douane peuvent s'appliquer.",
    );
  }
  return warnings;
}

// ── Entry point ──────────────────────────────────────────────────────

/**
 * Validate a parcel against the Algerian customs rules. Prohibited → blocked
 * (caller rejects at creation); otherwise returns declaration/franchise
 * warnings + the requiresDeclaration flag for the Parcel row.
 */
export function validateParcelCustoms(
  input: CustomsValidationInput,
): CustomsValidationResult {
  const haystack = normalize(
    [input.category, input.subCategory ?? "", input.description ?? ""].join(" "),
  );

  const violations: CustomsViolation[] = [];
  for (const rule of PROHIBITED) {
    if (rule.keywords.some((kw) => matchesKeyword(haystack, kw))) {
      violations.push({ rule: rule.id, message: rule.message });
    }
  }
  if (violations.length > 0) {
    return { blocked: true, violations, warnings: [], requiresDeclaration: false };
  }

  const warnings = declarationWarnings(input);
  return {
    blocked: false,
    violations: [],
    warnings,
    requiresDeclaration: warnings.length > 0,
  };
}
