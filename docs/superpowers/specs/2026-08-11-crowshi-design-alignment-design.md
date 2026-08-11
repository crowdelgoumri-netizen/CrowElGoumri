# Alignement du design Crowshi sur le cahier des charges (backend Z.AI)

**Date :** 2026-08-11 · **Statut :** approuvé par l'utilisateur (session Claude Code)

## Contexte

Le design mobile Crowshi (Claude Design, 21 écrans, `Crowshi App.dc.html`, reconstruit en artifact
autonome `claude.ai/code/artifact/43ee0241-607b-4e49-8f1f-93a45093565c`) utilise des placeholders
USD + routes africaines (Lagos↔London, Lagos↔Accra, Abuja↔Dubaï). Le backend réel
(`packages/api`, construit avec Z.AI selon `CROWDSHIPPING_MASTER_BLUEPRINT.md`) est
**EUR uniquement, corridor Europe↔Algérie**, notifications en français.

## Décisions (validées par l'utilisateur)

- **Langue UI : bilingue FR/EN** — français principal ; on conserve « Crowshi », les noms de
  features et les termes techniques courants (escrow, PIN, KYC).
- **Périmètre : contenu + terminologie** — pas de refonte visuelle, pas d'écrans ajoutés.
- **Livraison : republier sur la même URL d'artifact** + copie locale `design/crowshi-app-design.html`.

## Adaptations

| Avant (design) | Après (aligné backend) |
|---|---|
| Lagos ↔ London / Lagos ↔ Accra / Abuja ↔ Dubaï | Paris ↔ Alger / Marseille ↔ Oran / Lyon ↔ Constantine |
| Montants `$` | Montants `€` plausibles pour le corridor (~8–12 €/kg) |
| Textes anglais | Français principal (bilingue) |
| Noms placeholders | Prénoms plausibles diaspora algérienne |
| Dates `Aug 16` | Format français (`16 août`) |

Terminologie alignée sur les features codées : PIN de livraison à 6 chiffres, vérification
d'identité (KYC), paiement séquestré (escrow) à libération automatique, niveaux de confiance.

## Invariants

- Direction visuelle inchangée (dark navy/orange, Space Grotesk / Plus Jakarta Sans, glassmorphism).
- Structure et flux des 21 écrans inchangés.
- Le scope Europe↔Algérie est une frontière v1 **intentionnelle** (cible long terme : diaspora
  algérienne mondiale) — ne pas le traiter comme une limitation à corriger.
