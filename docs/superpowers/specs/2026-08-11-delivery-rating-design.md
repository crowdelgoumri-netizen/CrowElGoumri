# Notation à la livraison : brancher le modèle Rating existant

**Date :** 2026-08-11 · **Statut :** approuvé par l'utilisateur (session Claude Code)

## Contexte

Le modèle `Rating` existe déjà dans `packages/db/schema.prisma` (score 1-5, commentaire optionnel,
contrainte unique `(fromUserId, toUserId, parcelId)`), et `User.averageRating` est déjà lu à
plusieurs endroits (`trust-service.ts`, `matching.ts`, `me.ts`, `parcels.ts`, `trips.ts`) — mais
rien ne l'écrit jamais. `trust-service.ts` documente explicitement qu'il faut appeler
`recomputeTrustForUser(userId)` "after a new rating", ce hook n'est simplement jamais déclenché.

C'est le deuxième sous-projet du chantier "gaps fonctionnels" (après
[2026-08-11-report-to-disputes-design.md](2026-08-11-report-to-disputes-design.md)).

Le mockup design original (écran 16) montre l'expéditeur notant le voyageur juste après avoir
confirmé la livraison. Mais dans ce backend, c'est le **voyageur** qui saisit le PIN de livraison
(`POST /parcels/:id/deliver`), pas l'expéditeur — le moment "confirmation de livraison" n'est donc
pas symétrique entre les deux rôles comme le mockup le suppose.

## Décision (validée par l'utilisateur)

**Notation bidirectionnelle** : après livraison, l'expéditeur et le voyageur peuvent chacun noter
l'autre (comme Uber/Airbnb), pas seulement expéditeur → voyageur comme dans le mockup original.
Cohérent avec le modèle `Rating`, qui est intrinsèquement bidirectionnel.

## Backend — route `ratings.ts`

Nouveau fichier `packages/api/src/routes/ratings.ts`, enregistré dans `server.ts` au préfixe
`/ratings`, suivant les conventions de `disputes.ts` (Fastify + Zod + `assertParcelParticipant` +
`counterpartyOf`).

### `POST /ratings`

Body : `{ parcelId: string, score: number (1-5), comment?: string }`.

1. `assertParcelParticipant(parcelId, userId)` pour l'authentification/autorisation.
2. `toUserId` est **calculé côté serveur** via `counterpartyOf(participant)`, jamais fourni par le
   client — élimine toute possibilité de s'auto-noter ou de cibler le mauvais utilisateur.
3. Charge `parcel.status` ; si différent de `DELIVERED`, `409` ("Parcel not yet delivered").
4. Crée le `Rating`. La contrainte unique du schéma protège contre un double envoi ; capturer
   l'erreur Prisma `P2002` directement dans cette implémentation (pas de boucle de correction
   après-coup comme pour les disputes — on le fait bien du premier coup) et répondre `409`.
5. Après création réussie : recalcule la moyenne du noté avec
   `prisma.rating.aggregate({ where: { toUserId }, _avg: { score: true } })`, écrit le résultat
   dans `User.averageRating`, puis appelle `recomputeTrustForUser(toUserId)`.
6. `201` avec `{ rating }`.

### `GET /ratings/:parcelId`

Authentifié, réservé aux participants (`assertParcelParticipant`). Renvoie `{ ratings: Rating[] }`
— 0 à 2 lignes pour ce colis. Sert à l'écran mobile pour savoir si l'utilisateur courant a déjà
noté l'autre partie.

## Mobile

- `apps/mobile/src/lib/ratings.ts` — même forme que `lib/disputes.ts` : `submitRating(input)`,
  `getRatings(parcelId)`.
- `apps/mobile/app/delivery/[parcelId].tsx` : quand `parcel.status === "DELIVERED"`, appelle
  `getRatings(parcelId)` ; si l'utilisateur courant n'a pas encore de `Rating` avec
  `fromUserId === user.id` pour ce colis, affiche un petit widget 5 étoiles + commentaire optionnel
  (remplace/complète la carte statique "Colis livré ✓" actuelle) ; après envoi, affiche une
  confirmation "Merci pour votre avis".

## Hors périmètre

- Modification d'une note après envoi.
- Affichage public du détail des avis reçus (au-delà de la moyenne déjà exposée par `GET /me`).
- Toute logique liée aux litiges (`Dispute`) — les deux systèmes sont indépendants.
