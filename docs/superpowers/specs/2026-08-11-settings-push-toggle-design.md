# Réglages : toggle notifications push + retrait de la ligne debug

**Date :** 2026-08-11 · **Statut :** approuvé par l'utilisateur (session Claude Code)

## Contexte

`apps/mobile/app/settings.tsx` est volontairement minimal (commentaire en tête de fichier :
"real preferences (language, notifications granular controls) land with a settings subsystem
phase"). C'est le troisième sous-projet du chantier "gaps fonctionnels" identifié lors de l'audit
du design Crowshi adapté vs l'app mobile existante.

Le bucket original listait 4 items (moyens de paiement, langue, toggles notifications, retrait de
la ligne "Serveur API"). L'exploration a montré que deux sont actuellement infaisables ou
factices :

- **Moyens de paiement** : aucune API de cartes enregistrées (Stripe Customer/PaymentMethod)
  n'existe — seul `POST /escrow/:id/fund` (paiement par colis) est implémenté. Construire cet écran
  nécessiterait une intégration Stripe complète, bloquée en plus par la même limitation Expo Go que
  le paiement escrow (dev build requis, déjà mis de côté).
- **Sélecteur de langue** : aucune infrastructure d'internationalisation — 100% des textes sont en
  français codé en dur. Un sélecteur avec une seule langue fonctionnelle serait un faux bouton.

**Décision (validée par l'utilisateur)** : ce sous-projet se limite aux deux items réels et
immédiatement utiles — le toggle notifications push et le retrait de la ligne debug. Paiement et
langue restent hors périmètre.

## Découverte pendant l'exploration

`registerForPush()` (`apps/mobile/src/lib/push.ts`) est appelé automatiquement à chaque démarrage
de l'app tant que l'utilisateur est authentifié (`apps/mobile/app/_layout.tsx:73`), sans condition.
Un bouton "Réactiver les notifications" à sens unique ne suffit donc pas à faire un vrai toggle
ON/OFF : sans mécanisme de préférence persistée, désactiver puis relancer l'app réactiverait
silencieusement les notifications.

## Design

### `apps/mobile/src/lib/push.ts` devient la source de vérité

- Nouvelle préférence persistée localement (`AsyncStorage`, via le wrapper existant
  `apps/mobile/src/lib/storage.ts`) : `pushEnabled` (booléen). **Activé par défaut** si jamais
  défini — préserve le comportement actuel pour les utilisateurs existants et nouveaux.
- `isPushEnabled(): Promise<boolean>` — lit la préférence (défaut `true`).
- `setPushEnabled(enabled: boolean): Promise<void>` — écrit la préférence.
- `registerForPush()` vérifie `isPushEnabled()` en premier ; si `false`, retourne `null`
  immédiatement sans demander la permission OS ni appeler l'API — c'est ce qui rend le toggle
  OFF réellement silencieux au prochain démarrage.
- Sur un enregistrement réussi, le token est aussi sauvegardé localement (nouvelle clé de
  storage) pour pouvoir le désenregistrer plus tard sans le redemander à l'OS.

### `apps/mobile/app/settings.tsx`

- La ligne "Réactiver les notifications" (actuellement un `PressableRow` à sens unique) devient un
  vrai toggle : composant `Switch` de React Native (natif, stylé aux couleurs de l'app — accent
  `#FF6A2B` / fond `navySoft`), pas un nouveau composant partagé.
  - État initial lu via `isPushEnabled()` au montage.
  - ON→rien à OFF : appelle `setPushEnabled(false)`, puis désenregistre le token connu s'il existe
    (`unregisterDeviceToken`, déjà exposé par `lib/notifications-api.ts`), puis efface le token
    stocké localement.
  - OFF→ON : appelle `setPushEnabled(true)` puis `registerForPush()` immédiatement (retour visuel
    tout de suite, pas d'attente du prochain démarrage).
- Retrait de la ligne "Serveur API" (`Row icon="server-outline" ...`) et de l'import `BASE_URL`
  devenu inutile.

### Backend

**Aucun changement.** `POST /notifications/device-token` et `DELETE /notifications/device-token`
existent déjà et couvrent exactement ce dont ce toggle a besoin.

## Hors périmètre

- Moyens de paiement, sélecteur de langue (reportés, cf. Contexte).
- Toggle "e-mails d'actualité" — le canal e-mail (AWS SES) n'est pas encore branché en v1 ; un
  toggle stockant une préférence sans effet réel serait cosmétique.
- Gestion multi-device fine (le modèle `deviceTokens` reste un tableau par utilisateur ; ce toggle
  agit sur le device courant uniquement, cohérent avec le comportement actuel).
