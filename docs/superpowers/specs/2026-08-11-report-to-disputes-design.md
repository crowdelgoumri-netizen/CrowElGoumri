# Signalements : brancher report.tsx sur le backend (Dispute)

**Date :** 2026-08-11 · **Statut :** approuvé par l'utilisateur (session Claude Code)

## Contexte

`apps/mobile/app/report.tsx` capture un signalement côté client uniquement (`setTimeout` +
`Alert`) — rien n'est envoyé ni persisté. Le modèle `Dispute` existe déjà dans
`packages/db/schema.prisma` (raisons typées, SLA de résolution 72h, statuts OPENED → MEDIATING →
ESCALATED → RESOLVED/CLOSED) mais aucune route API ne l'expose, et `ParcelStatus.DISPUTED` n'est
référencé nulle part dans le code actuel.

C'est le premier sous-projet du chantier "gaps fonctionnels" identifié lors de l'audit du design
Crowshi adapté vs l'app mobile existante (voir
[2026-08-11-crowshi-design-alignment-design.md](2026-08-11-crowshi-design-alignment-design.md)).
Les autres sous-projets (notation à la livraison, gains du voyageur, réglages incomplets,
incohérence de marque) sont traités séparément.

## Décisions (validées par l'utilisateur)

- **Motifs de signalement alignés sur l'enum backend `DisputeReason`** (8 valeurs), pas la liste
  actuelle ad hoc (Retard, Endommagé, Non livré, Paiement, Comportement, Autre) qui ne correspond
  qu'à moitié à l'enum.
- **Point d'entrée déplacé** : depuis le colis/trajet concerné (`parcel/[id].tsx`,
  `trip/[id].tsx`), pas depuis un menu générique dans Réglages — cohérent avec la contrainte
  `Dispute.parcelId` unique (un litige par colis) et avec l'écran 13 du design qui montre déjà le
  contexte trajet/voyageur.

## Backend — route `disputes.ts`

Nouveau fichier `packages/api/src/routes/disputes.ts`, enregistré dans `server.ts` avec le préfixe
`/disputes`, suivant les conventions de `kyc.ts` (Fastify + Zod + `app.authenticate`).

### `POST /disputes`

Body : `{ parcelId: string, reason: DisputeReason, description: string }`.

1. Charge le colis avec `matchedTrip.travelerId` et `senderId` (même pattern que
   `loadForTravelerStep` dans `parcels.ts`).
2. Vérifie que l'appelant est soit `parcel.senderId`, soit `parcel.matchedTrip.travelerId` — sinon
   403.
3. Vérifie qu'aucun `Dispute` n'existe déjà pour ce `parcelId` — sinon 409 (la contrainte unique en
   base le garantit aussi, mais on renvoie une erreur explicite avant l'insert).
4. Crée le `Dispute` : `openedById = req.user.sub`, `reason`, `description`, `status = OPENED`,
   `mustResolveBy = now + 72h`.
5. Met à jour `parcel.status = DISPUTED`.
6. Notifie l'autre partie (sender ↔ traveler) via `notify()` avec un nouveau type
   `DISPUTE_OPENED` ajouté à `NotificationType` dans `lib/notifications.ts`.
7. Log `app.log.info` pour visibilité ops (même motif que KYC : pas de file d'admin en v1).
8. Renvoie `201` avec le `Dispute` créé.

### `GET /disputes/:parcelId`

Authentifié, réservé aux participants du colis (sender ou traveler assigné) — 403 sinon. Renvoie
le `Dispute` existant ou `null`. Sert à l'écran mobile pour afficher l'état "déjà signalé" au lieu
du formulaire.

### Hors périmètre (explicite, pas oublié)

- File de modération admin (`GET/POST /disputes/admin/...`) — chantier séparé, comme la review
  queue KYC.
- Upload de preuves photo (`evidenceUrls`) — le formulaire actuel n'a pas de sélecteur d'image, on
  n'en ajoute pas ici.
- Blocage des autres actions (libération d'escrow, confirmation de livraison) pendant qu'un colis
  est `DISPUTED` — aucun garde n'existe aujourd'hui dans `escrow.ts`/`parcels.ts` pour ce statut ;
  ce sous-projet ne le change pas. Écrire noir sur blanc : un signalement ouvert n'empêche
  aujourd'hui aucune autre transition. C'est un gap connu pour un futur chantier "état du litige
  dans le cycle de vie du colis".

## Mobile

### Route

`app/report.tsx` → `app/report/[parcelId].tsx`, paramètre `parcelId` lu via `useLocalSearchParams`.

### Motifs (alignés `DisputeReason`, filtrés par rôle)

| Valeur enum | Libellé FR | Visible pour |
|---|---|---|
| `PARCEL_NOT_DELIVERED` | Colis non livré | sender + traveler |
| `PARCEL_DAMAGED` | Colis endommagé | sender + traveler |
| `PARCEL_STOLEN` | Colis volé | sender + traveler |
| `CUSTOMS_SEIZURE` | Saisie en douane | sender + traveler |
| `TRAVELER_NO_SHOW` | Le voyageur n'est jamais venu | **sender uniquement** |
| `SENDER_NO_SHOW` | L'expéditeur n'est jamais venu | **traveler uniquement** |
| `FRAUD_ATTEMPT` | Tentative de fraude | sender + traveler |
| `OTHER` | Autre | sender + traveler |

Le rôle de l'appelant (sender ou traveler) se déduit du colis chargé par l'écran (déjà disponible
dans `parcel/[id].tsx`/`trip/[id].tsx` avant la navigation) et est passé en paramètre de route.

### Comportement de l'écran

1. Au montage, appelle `GET /disputes/:parcelId`.
2. S'il existe déjà un litige → affichage lecture-seule (motif, description, statut, date
   d'ouverture, `mustResolveBy`), pas de formulaire.
3. Sinon → formulaire actuel (Select motif filtré par rôle + Input description) qui `POST
   /disputes` au lieu du `setTimeout` actuel.
4. Succès → même `Alert` de confirmation qu'aujourd'hui, retour à l'écran précédent.
5. 409 (déjà signalé, race condition) → recharge l'état lecture-seule au lieu d'afficher une
   erreur.

### Points d'entrée

- Ajout d'un bouton "Signaler un problème" dans `parcel/[id].tsx` (zone d'actions, visible à partir
  de `MATCHED`) → `router.push(`/report/${parcel.id}`)`.
- Ajout du même bouton dans `trip/[id].tsx` pour la vue voyageur d'un colis assigné.
- Suppression de l'entrée générique `PressableRow` "Signaler un problème" dans `settings.tsx`.

## Testing

- Route : cas 403 (non-participant), 409 (doublon), 201 (succès sender), 201 (succès traveler),
  vérifier `parcel.status` passe à `DISPUTED` et que `notify()` est appelé avec le bon destinataire.
- Mobile : rendu du formulaire filtré par rôle, transition formulaire → lecture-seule après succès,
  et lecture-seule directe si un litige existe déjà au montage.
