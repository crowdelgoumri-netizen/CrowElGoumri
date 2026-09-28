# Parrainage (F14) : code de référence personnel + crédit de réduction sur la fee

**Date :** 2026-08-28 · **Statut :** approuvé par l'utilisateur (session Claude Code)

## Contexte

Le blueprint (`NewDesign/CROWDSHIPPING_MASTER_BLUEPRINT.md:51`) liste F14 "Code promo /
parrainage — mécanisme d'acquisition virale" en P1, sans aucun détail d'implémentation — contrairement
aux autres specs de ce dossier, il n'existe aucune trace de ce système dans le schéma ou les routes
actuelles (`grep` sur "referral", "promo", "parrainage" dans `packages/db/schema.prisma` et
`packages/api/src` : aucun résultat).

Décisions validées par l'utilisateur avant cette spec :

- **Récompense** : crédit de réduction sur la platform fee (pas de crédit cash, pas de simple boost
  de trustScore).
- **Scope** : parrainage pair-à-pair uniquement. Pas de codes promo génériques créés par un admin —
  ce sera un chantier séparé s'il est un jour nécessaire, réutilisant la même plomberie de rédemption.
- **Déclencheur de conversion** : la première livraison **complétée** du filleul (premier escrow qui
  atteint `RELEASED`, en tant que sender ou traveler) — pas le signup seul, pas la vérification KYC
  seule. Nécessite un vrai mouvement d'argent, ce qui rend le farming de faux comptes coûteux.
- **Forme du crédit** : pourcentage fixe, à usage unique ("one-shot"), pas un solde EUR qui se
  consomme partiellement.
- **Plafond anti-abus** : aucun. Chaque parrainage réussi (signup + première livraison réelle du
  filleul) crédite le parrain, sans limite de nombre. Le filtre "première livraison complétée" est
  jugé suffisant pour une feature P1.

## Modèle de données (`packages/db/schema.prisma`)

### `User.referralCode`

Nouveau champ `referralCode String @unique @db.VarChar(8)`, généré une fois à la création du
compte : 8 caractères alphanumériques **majuscules**, non-ambigus (exclure `0/O/1/I`), immuable.
Toujours généré et comparé en majuscules — évite de dépendre d'une recherche case-insensitive côté
Postgres.

### `Referral`

```prisma
model Referral {
  id          String   @id @default(uuid())
  referrerId  String
  referrer    User     @relation("ReferralsMade", fields: [referrerId], references: [id])
  refereeId   String   @unique   // un seul parrain possible par personne
  referee     User     @relation("ReferralsReceived", fields: [refereeId], references: [id])
  code        String   // snapshot du code utilisé au signup
  status      ReferralStatus @default(PENDING)
  createdAt   DateTime @default(now())
  rewardedAt  DateTime?

  @@index([referrerId])
  @@index([status])
}

enum ReferralStatus {
  PENDING
  REWARDED
}
```

La contrainte `@unique` sur `refereeId` empêche qu'une personne soit parrainée deux fois (peu
importe combien de codes elle entre, seul le premier `Referral` créé au signup existera).

### `ReferralCredit`

```prisma
model ReferralCredit {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  discountPct      Decimal   @db.Decimal(4, 2) // ex: 50.00
  consumedAt       DateTime?
  consumedEscrowId String?

  createdAt        DateTime  @default(now())

  @@index([userId, consumedAt])
}
```

Un ledger de crédits discrets plutôt qu'un solde unique sur `User` : chaque parrainage récompensé
crée une ligne (une pour le parrain, une pour le filleul). Le parrainage illimité s'empile
naturellement — chaque crédit est consommé indépendamment (FIFO) au premier `fund` futur qui en
trouve un disponible, sans logique de solde partiel à gérer.

`discountPct` par défaut : **50%**. Valeur codée en dur dans une constante (`REFERRAL_DISCOUNT_PCT`
dans `packages/api/src/lib/referral-service.ts`), pas de configuration admin dans ce scope.

## Signup — saisie du code (`packages/api/src/routes/auth.ts`)

`signupSchema` (ligne 23) reçoit un champ optionnel :

```ts
referralCode: z.string().length(8).toUpperCase().optional(),
```

Dans le handler `POST /signup` (ligne 55), après la création du `User` :

1. Si `referralCode` est fourni (déjà normalisé en majuscules par le schema Zod), chercher un
   `User` dont `referralCode` correspond exactement.
2. Code introuvable → **ne bloque jamais le signup**, on ignore silencieusement (pas d'erreur 400 :
   une faute de frappe sur un code promo ne doit jamais empêcher la création de compte).
3. Code trouvé → créer `Referral({ referrerId: match.id, refereeId: newUser.id, code, status: PENDING })`
   dans la même transaction Prisma que la création du user.
4. Auto-parrainage structurellement impossible : le filleul n'existe pas encore au moment de la
   saisie du code, donc `referrerId !== refereeId` est garanti sans check supplémentaire.

## Déclenchement de la récompense (`packages/api/src/lib/escrow-service.ts`)

Dans `releaseEscrowForParcel` (ligne 49), juste après la transition réussie vers `RELEASED` :

1. Récupérer `senderId` et `travelerId` de l'escrow qui vient d'être libéré.
2. Pour chacun des deux, vérifier s'il a un `Referral` `PENDING` où il est `refereeId`, ET si c'est
   son **premier** escrow `RELEASED` (compter les escrows `RELEASED` où il est sender OU traveler ;
   si le compte est 1 juste après cette transition, c'est le premier).
3. Si oui : dans une transaction Prisma —
   - `Referral.status = REWARDED`, `rewardedAt = now()`
   - créer un `ReferralCredit` pour `referrerId` (discountPct = REFERRAL_DISCOUNT_PCT)
   - créer un `ReferralCredit` pour `refereeId` (même montant)
   - créer deux `Notification` (modèle existant) informant chaque partie
4. Idempotence : la transition `PENDING → REWARDED` se fait avec un `updateMany` filtré sur
   `status: PENDING`, donc en cas de double-appel concurrent (deux escrows du même filleul libérés
   en même temps), un seul gagne la course et un seul crédit est émis.

## Consommation du crédit (`packages/api/src/routes/escrow.ts`, `POST /:parcelId/fund`)

Au moment du calcul du breakdown (ligne ~129, avant l'appel Stripe) :

1. Chercher le `ReferralCredit` non consommé le plus ancien du sender
   (`where: { userId: senderId, consumedAt: null }, orderBy: { createdAt: "asc" }`).
2. Si trouvé, passer son `discountPct` à `computePayoutBreakdown` (nouveau 4e paramètre optionnel,
   défaut `0` — rétrocompatible avec tous les appels existants). En interne, la fonction réduit le
   `platformFee` brut de `discountPct`% **avant** de calculer `totalAmount` et `travelerPayout` à
   partir de ce fee réduit :
   ```ts
   const rawPlatformFee = Math.round((price * feeBps) / 10000);
   const discountAmount = Math.round(rawPlatformFee * (Number(discountPct) / 100));
   const platformFee = rawPlatformFee - discountAmount;
   // totalAmount et travelerPayout dérivent de `platformFee` comme aujourd'hui
   ```
   Comme `travelerPayout = totalAmount − platformFee − insurance` et que `totalAmount` inclut ce
   même `platformFee` réduit, le `travelerPayout` reste égal à `travelerPrice` — la réduction
   ampute uniquement la part que la plateforme se serait versée, jamais le voyageur. (Réduire
   directement `totalAmount` sans toucher `platformFee` serait un bug : la formule existante
   répercuterait la réduction sur le voyageur.)
3. Après création réussie du PaymentIntent Stripe : marquer le crédit
   `consumedAt = now(), consumedEscrowId = escrow.id`.
4. Si le paiement échoue avant confirmation (intent non confirmé), le crédit reste marqué consommé
   dès lors qu'un PaymentIntent a été créé avec le montant réduit — cohérent avec le comportement
   existant du endpoint qui réutilise l'intent existant en cas de retry (ligne 133-147).

## Mobile

- `apps/mobile/src/lib/referrals.ts` : `getMyReferralCode()`, `getMyReferrals()` (liste
  parrain→filleuls avec statut), suit le pattern de `lib/ratings.ts` / `lib/disputes.ts`.
- Écran signup : champ optionnel "Code de parrainage".
- Nouvel écran "Inviter des amis" (accessible depuis Profil/Réglages) : affiche le code personnel +
  bouton de partage natif (`Share` API Expo), liste des parrainages en cours/récompensés.
- Écran de financement (`fund`) : si un crédit est disponible et va être appliqué, afficher un
  bandeau "Réduction de parrainage appliquée" pour que la réduction ne soit pas silencieuse.

## Hors périmètre

- Codes promo génériques créés par un admin (marketing, campagnes) — scope explicitement exclu par
  l'utilisateur, plomberie de `Referral`/`ReferralCredit` réutilisable plus tard si besoin.
- Ré-application d'un code après le signup (le filleul ne peut entrer un code qu'à l'inscription).
- Plafond anti-abus sur le nombre de parrainages récompensés par personne.
- Expiration des crédits (`ReferralCredit` n'a pas de `expiresAt` — reste valide indéfiniment tant
  que non consommé).
- Application du crédit ailleurs qu'à la fee du sender (ex: bonus visibilité matching pour le
  traveler) — hors scope de cette spec.
