# Customs compliance engine: prohibited-items block + franchise/declaration checks

**Date:** 2026-08-13 · **Status:** approved + implemented (ZCode session)

## Context

Customs seizure is flagged **Risk #1** for the France↔Algeria corridor (blueprint
§6 pre-mortem: *"Colis interdits — blocage programmatique par catégorie"*). Today
nothing enforces it:

- The lifecycle already has the states — `IN_TRANSIT → CUSTOMS_CHECK →
  {IN_TRANSIT | SEIZED | DISPUTED}`, `SEIZED` terminal (`lib/lifecycle.ts:27-33`).
- The schema already has the fields — `Parcel.category`, `subCategory`,
  `estimatedValue`, `requiresDeclaration`, `customsCategory`,
  `customsDeclarationId`, and a full `CustomsClearanceLog` model.
- Matching filters on `traveler.blockedCategories` (a preference), but **no rule
  anywhere rejects prohibited items or flags over-franchise parcels.** A sender
  can post "Drone" today and it enters the marketplace, gets matched, and ships.

Blueprint §4.1 specifies exactly what should be enforced: a *franchise voyageur*
table (Articles 68-73 du Code des Douanes), a prohibited-products blacklist with
**programmatic blocking**, and a validation algorithm run at parcel creation +
matching.

This chantier implements the **deterministic, rule-based** core of that engine.
The AI image-classification step in the blueprint (§4.1.3 step 4) is explicitly
out of scope — it needs an external ML service and is deferred.

## Decision: deterministic rule engine at the parcel-creation chokepoint

A pure, unit-tested `packages/api/src/lib/customs.ts` encodes two rulesets and a
single `validateParcelCustoms(parcel)` entry point, invoked once in the
`POST /parcels` handler. **No schema change** — every field it needs already
exists. **No AI** — keyword + threshold rules only, deterministic and auditable.

**Block vs warn semantics** (the central design call):
- **Prohibited** → the parcel is **rejected at creation (400)** with the
  prohibition message; it never enters the marketplace. This is the strongest
  guard — a prohibited item can't be matched or shipped. (The blueprint's
  `BLOCKED_CUSTOMS` status is for the AI high-confidence path; for programmatic
  category prohibition, reject-at-creation is cleaner than leaving dead rows.)
- **Declaration-required / over-franchise** → the parcel is **created** with
  `requiresDeclaration = true`, and the response carries the warnings so the
  sender is told they must declare at customs. The sender proceeds, accepting
  that duty.

## The rules (encoded from blueprint §4.1)

### 1. Prohibited — hard block at creation
Case-insensitive keyword match against `{ category, subCategory, description }`.
Each rule carries a user-facing French message + its legal basis.

| Signal keyword(s) | Message |
|---|---|
| drone(s) | *"Les drones sont interdits à l'importation en Algérie (Arrêté ministériel 2015)."* |
| arme / weapon / munition / airsoft | *"Les armes et munitions sont strictement interdites."* |
| stupéfi / narcotic / psychotrope | *"Les stupéfiants sont strictement interdits."* |
| contrefaçon / counterfeit | *"Les contrefaçons sont interdites (droit algérien et international)."* |
| alcool / alcohol | *"L'alcool ne peut pas être transporté via CrowdShipping."* |
| walkie / radio non agréé | *"Le matériel de communication non homologué est interdit."* |
| satellite phone / gps haute précision | *"Les téléphones satellites et GPS haute précision sont interdits."* |
| israélien / israeli product | *"Les produits israéliens sont interdits (loi algérienne)."* |

A match **anywhere** in category/subCategory/description blocks. This errs
toward flagging — the safe side for a customs gate; a false positive blocks a
borderline item with a clear message rather than risking seizure.

On block, log `app.log.warn({ event: "PROHIBITED_ITEM_ATTEMPT", userId,
parcelCategory, matchedRule })` for anti-fraud observability. A real
`SecurityEvent` table is deferred to the fraud phase.

### 2. Declaration-required — warn + flag (parcel is still created)
Run only if not blocked. Sets `requiresDeclaration = true` and collects warnings:

- **Electronics** with `estimatedValue > 300 EUR` → *"Les appareils électroniques
  > 300 EUR nécessitent une déclaration douanière spéciale."*
- **Medicine** (any) → *"Les médicaments nécessitent une ordonnance (max 3 mois
  de traitement)."* (v1 warns + flags; verifying an uploaded prescription is
  deferred — see Out of scope.)
- **Cosmetics** → *"Maximum 5 produits cosmétiques sous franchise voyageur."*
  (v1 warns; per-traveler item counting is deferred.)
- **Any category** with `estimatedValue > 120 EUR` (≈ 30 000 DZD, franchise
  voyageur ceiling) → *"La valeur dépasse la franchise voyageur (≈ 30 000 DZD) —
  des droits de douane peuvent s'appliquer."*

The 120 EUR / 300 EUR thresholds are EUR constants derived from the blueprint's
DZD franchise at the official rate; documented in-code with the DZD origin.

## Integration

- **`POST /parcels`** (`routes/parcels.ts`): after the existing zod parse +
  auth, call `validateParcelCustoms(input)`.
  - If `result.blocked` → `400 { error, violations: string[] }` (do **not**
    create the parcel).
  - Else create with `requiresDeclaration: result.requiresDeclaration`, and
    return `{ parcel, customs: { warnings: string[] } }`.
- **Matching** (`routes/matching.ts`): no change. Prohibited items are blocked at
  creation, so they never reach matching; the existing `blockedCategories`
  preference filter is orthogonal and stays.
- Re-check on `PATCH /parcels/:id` changes to category/value: optional
  defense-in-depth, **deferred** — parcels aren't meaningfully edited post-create
  in v1.

## Tests

`packages/api/src/test/customs.test.ts` (node:test, matching the existing
`packages/api/src/test/*.test.ts` style):
- Drone in subCategory → blocked with the drone message.
- "Other" + description containing "arme" → blocked.
- Electronics 350 EUR → warning + `requiresDeclaration`.
- Cosmetics 20 EUR → cosmetics warning (no block).
- Medicine → prescription warning + flag.
- Estimated value 150 EUR (other category) → franchise warning.
- Clean electronics parcel 50 EUR → no block, no warning.

## Out of scope (deferred, with rationale)

- **AI image classification** (§4.1.3 step 4) — needs an external ML/vision
  service; the biggest unbuilt piece, but genuinely a separate dependency.
- **Cross-traveler quantity aggregation** — "max 2 electronics per traveler",
  "total franchise < 30 000 DZD across the traveler's matched parcels" need
  trip-scoped counting. v1 is per-parcel.
- **Prescription upload + verification** (`prescriptionUrl`) — would add a schema
  field + mobile collection UI; v1 warns + flags medicine only.
- **Seizure insurance/payout logic** (§4.2 ToS clauses) — the insurance product
  itself is stubbed (`Parcel.hasInsurance`); those clauses are ToS text until
  insurance lands.
- **`SecurityEvent` table** — v1 logs to `app.log`; a real events model belongs
  to the fraud/anti-abuse phase.
- **`CustomsClearanceLog` population at the border** — that's the
  traveler-reported `CUSTOMS_CHECK → SEIZED|CLEARED` flow, a separate lifecycle
  wiring; this spec is the *creation-time gate*, not the in-transit flow.
