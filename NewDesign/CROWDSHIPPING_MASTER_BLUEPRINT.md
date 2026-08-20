# 🚀 CrowdShipping Algérie — Master Blueprint v1.0

**Document fondateur | Investor Pitch & Engineering Specs**
**Date : 6 août 2026 | Classification : CONFIDENTIEL — Founders & Dev Team Only**

> Ce document constitue le cahier des charges ultime pour la conception, le développement et le lancement de **CrowdShipping**, une plateforme P2P de transport de colis ciblant l'Algérie (diaspora + domestique). Il a été élaboré par une task force pluridisciplinaire : Product/Growth, Droit Douanier Algérien, Fintech/Payments, et Architecture Technique.

---

## Table des Matières

1. [PARTIE 1 : PRD & UX/UI Avancée](#partie-1--prd--uxui-avancée)
2. [PARTIE 2 : Architecture Technique & Stack](#partie-2--architecture-technique--stack)
3. [PARTIE 3 : Ingénierie Financière](#partie-3--ingénierie-financière--le-problème-du-square-fintech)
4. [PARTIE 4 : Matrice Légale, Douanière & Conformité](#partie-4--matrice-légale-douanière-et-conformité-le-mur)
5. [PARTIE 5 : Go-To-Market, Growth Hacking & Saisonnalité](#partie-5--go-to-market-growth-hacking--saisonnalité)
6. [PARTIE 6 : Analyse des Risques (Pre-Mortem)](#partie-6--analyse-des-risques-pre-mortem)

---

# PARTIE 1 : PRD & UX/UI Avancée

## 1.1 Vision Produit

CrowdShipping est une **marketplace bilatérale** (two-sided) qui connecte :

| Rôle | Profil Type | Motivation |
|------|-------------|------------|
| **Sender (Expéditeur)** | Membre de la diaspora en France/Canada/Espagne, ou résidant algérien | Besoin d'envoyer un colis rapidement, à moindre coût, et avec traçabilité |
| **Traveler (Voyageur)** | Voyageur régulier (vol, ferry, route), étudiant retournant au pays, chauffeur routier | Monétiser l'espace vide dans ses bagages / véhicule |

**Proposition de valeur** : Remplacer le marché informel du "Cabas" par un système sécurisé, tracé, assuré et conforme — à 40-60% moins cher que DHL/Chronopost.

### 1.1.1 Fonctionnalités Core (MVP)

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| F01 | Création d'annonce de colis | P0 | Sender décrit colis (type, poids, dimensions, photo), origine, destination, urgence |
| F02 | Création de trajet voyageur | P0 | Traveler publie son itinéraire (départ, arrivée, date, capacité restante en kg/volume) |
| F03 | Matching algorithmique | P0 | Système propose les meilleurs Travelers pour chaque colis (voir §1.4) |
| F04 | Escrow (séquestre) | P0 | L'argent est bloqué jusqu'à confirmation de livraison (voir Partie 3) |
| F05 | Géolocalisation fallback | P0 | Système d'adressage alternatif basé PIN/POI/live-location (voir §1.3) |
| F06 | KYC vérifié | P0 | Vérification d'identité pour tout utilisateur (CIN/Passport + selfie) |
| F07 | Scoring de confiance | P0 | Système de réputation multi-signaux (voir §1.5) |
| F08 | Messagerie in-app | P0 | Chat chiffré entre Sender et Traveler |
| F09 | OTP/QR validation | P0 | Code à 6 chiffres ou QR pour valider la remise (voir Partie 4) |
| F10 | Assurance colis | P1 | Couverture optionnelle jusqu'à 2,000 EUR par envoi |
| F11 | Déclaration douanière intégrée | P1 | Formulaire interactif respectant les limites de franchise voyageur (voir Partie 4) |
| F12 | Notifications push/SMS | P0 | Statut de livraison, urgences, rappels |
| F13 | Paiement multi-devises | P0 | EUR → DZD, EUR cash, DZD cash, CB, virement (voir Partie 3) |
| F14 | Code promo / parrainage | P1 | Mécanisme d'acquisition virale |
| F15 | Dashboard "Mes Envois" / "Mes Trajets" | P0 | Historique complet, statut en temps réel |

---

## 1.2 User Journeys Détaillés (Edge-Cases)

### 🔴 Edge-Case #1 : L'étudiant à Paris → Alger (Urgence + Haute Valeur)

**Persona** : Karim, 23 ans, étudiant en Master à Paris-La Défense.
**Besoin** : Envoyer un ordinateur portable (Lenovo ThinkPad, ~2.3 kg, valeur 1,200 EUR) et deux ordonnances médicales (médicaments contre le diabète pour sa mère à Bab El Oued, Alger) pour le week-end prochain.

**Parcours détaillé étape par étape :**

```
ÉTAPE 1 : ONBOARDING & KYC
├─ Karim ouvre l'app → Crée un compte (email + téléphone algérien +06XX)
├─ KYC requis (première utilisation) :
│   ├─ Upload passeport français ou algérien
│   ├─ Selfie vivante (liveness detection via Onfido SDK)
│   └─ Vérification automatique (98% de taux d'approbation en < 2 min)
├─ Score de confiance initial : 35/100 (nouveau compte, pas d'historique)
│
ÉTAPE 2 : CRÉATION DE L'ENVOI
├─ Écran "Nouvel Envoi" :
│   ├─ Type de colis : MULTIPLE (2 articles dans 1 colis)
│   ├─ Article 1 : Ordinateur portable
│   │   ├─ Catégorie : Électronique > Ordinateurs
│   │   ├─ Poids estimé : 2.3 kg
│   │   ├─ Dimensions : 35 x 25 x 3 cm
│   │   ├─ Valeur déclarée : 1,200 EUR
│   │   ├─ Photo : Upload photo + facture d'achat
│   │   └─ ⚠️ ALERTE AUTOMATIQUE : "Articles électroniques d'une valeur > 300 EUR
│   │       sont soumis à déclaration douanière spéciale en Algérie.
│   │       Voir Article 68 du Code des Douanes."
│   │   └─ ✅ Bouton "Voir les règles douanières" → Modal explicatif
│   ├─ Article 2 : Médicaments
│   │   ├─ Catégorie : Médicaments > Usage personnel
│   │   ├─ Poids estimé : 0.4 kg
│   │   ├─ Valeur : 45 EUR
│   │   ├─ Upload photo de l'ordonnance (+ traduction arabe/française)
│   │   └─ ⚠️ ALERTE : "Les médicaments doivent être accompagnés d'une ordonnance.
│   │       Quantité limitée à 3 mois de traitement personnel."
│   │   └─ ✅ Validation automatique de l'ordonnance (OCR par MINDETs code N°)
│   ├─ Origine : Paris 15e, métro Vaugirard (POI sélectionné)
│   ├─ Destination : Bab El Oued, Alger
│   │   └─ ⚠️ Pas d'adresse standardisée détectée
│   │   └─ → Activation du système PIN (voir §1.3)
│   │   └─ Karim génère un PIN de remise à 6 chiffres → l'envoie par WhatsApp à sa mère
│   ├─ Urgence : HAUTE (livraison souhaitée sous 72h)
│   ├─ Assurance : OUI (coût : 3% de la valeur déclarée = 36 EUR)
│   └─ Budget max pour le voyageur : 40 EUR (vs ~85 EUR pour Chronopost)
│
ÉTAPE 3 : MATCHING ALGORITHMIQUE
├─ Algorithme scanne les Travelers actifs :
│   ├─ Résultat #1 : Ahmed, vol Paris→Alger ORY-ALG, demain 14h30
│   │   ├─ Score de matching : 94/100
│   │   ├─ Profil vérifié (score : 82/100), 12 trajets complétés, 0 litige
│   │   ├─ Capacité restante : 8 kg (suffisant)
│   │   ├─ Départ dans 18h → respecte l'urgence
│   │   └─ Tarif demandé : 30 EUR
│   ├─ Résultat #2 : Nadia, ferry Marseille→Alger, arrive dans 36h
│   │   ├─ Score : 78/100 (délai un peu long pour l'urgence)
│   │   ├─ Profil : score 91/100, 45 trajets
│   │   ├─ Tarif : 25 EUR
│   │   └─ ⚠️ Attention : le ferry peut avoir des retards de 4-12h
│   └─ Résultat #3 : Youcef, vol Orly→Alger, après-demain
│       └─ Score : 52/100 (trop tard pour urgence 72h)
├─ Karim sélectionne Ahmed → Notification envoyée à Ahmed
│
ÉTAPE 4 : NÉGOCIATION & ACCEPTATION
├─ Ahmed reçoit notification push : "Nouveau colis compatible avec votre trajet"
├─ Ahmed voit le détail du colis + photos + valeur déclarée
├─ ⚠️ SYSTÈME ANTI-FRAUDE (background) :
│   ├─ Vérification que Karim n'a pas créé 5 envois identiques (anti-money laundering)
│   ├─ Cross-check de la facture (OCR détecte cohérence prix/marque)
│   └─ Check du KYC : Ahmed vérifié, pas sur liste noire
├─ Ahmed accepte → Contrat digital généré automatiquement (CGU signées par les deux)
│
ÉTAPE 5 : PAIEMENT & ESCROW
├─ Karim paie 30 EUR (tarif voyageur) + 36 EUR (assurance) + 3 EUR (fee plateforme) = 69 EUR
├─ Paiement par carte bancaire française (Stripe)
├─ Les 69 EUR sont bloqués dans l'Escrow (LemonWay wallet)
├─ Statut : "PAIEMENT BLOQUÉ — En attente de remise"
│
ÉTAPE 6 : REMISE PHYSIQUE (PARIS)
├─ Karim et Ahmed coordonnent via chat in-app :
│   ├─ RDV : Café Les Deux Magots, Paris 6e, demain 10h
│   ├─ Ahmed scanne le QR code du colis → statut "Colis pris en charge"
│   ├─ Karim reçoit notification : "Votre colis a été récupéré"
│   └─ Photo obligatoire du colis emballé (prise par Ahmed, horodatée, géotaggée)
│
ÉTAPE 7 : TRAJET (VOL PARIS→ALGER)
├─ Pendant le vol, Ahmed reçoit un rappel automatique :
│   │   "N'oubliez pas : vous transportez un colis pour Karim B.
│   │   Valeur déclarée : 1,245 EUR. Destination : Bab El Oued, Alger.
│   │   Rappel : déclarez vos effets personnels à la douane si nécessaire."
│   ├─ Checkpoint douanier à ALG (action du voyageur) :
│   │   ├─ Ahmed coche dans l'app : "Passé la douane — Aucun problème" OU
│   │   ├─ Ahmed coche : "Douane — Contrôle en cours"
│   │   └─ Si contrôle : notification Karim + démarrage timer d'attente max 4h
│
ÉTAPE 8 : LIVRAISON (BAB EL OUED)
├─ Ahmed arrive à Alger → activation de la live-location dans le chat
├─ Ahmed entre en contact avec la mère de Karim (numéro fourni)
├─ ⚠️ La mère ne sait pas utiliser l'app → MODE "RÉCEPTION TIERCE"
│   ├─ Ahmed lui demande le PIN de remise (6 chiffres communiqué par Karim via WhatsApp)
│   ├─ Ahmed saisit le PIN dans l'app → vérification → ✅ VALIDÉ
│   ├─ Ahmed et la mère signent numériquement ( empreinte digitale si possible, sinon Ahmed coche "Remis en main propre")
│   └─ Photo du colis remis (optionnel mais recommandé, avec la permission de la mère)
│
ÉTAPE 9 : DÉBLOCAGE ESCROW
├─ PIN validé → Escrow débloqué automatiquement :
│   ├─ 27 EUR → Compte LemonWay d'Ahmed ( après fee plateforme 10% = 3 EUR)
│   ├─ 36 EUR → Assurance (conservée par le partenaire assureur, déclenchée si litige)
│   ├─ 3 EUR → Fee plateforme CrowdShipping
│   └─ 3 EUR → Taxe de traitement
├─ Ahmed peut retirer via virement SEPA ou cash (Point de retrait partenaire à Alger)
│
ÉTAPE 10 : POST-LIVRAISON
├─ Notification Karim : "Colis livré avec succès ✅"
├─ Karim note Ahmed : 5 étoiles + commentaire "Très professionnel et ponctuel"
├─ Score Ahmed passe de 82 → 85/100
├─ Score Karim passe de 35 → 50/100 (premier envoi réussi)
└─ Demande de review : "Karim, votre avis nous intéresse !"
```

---

### 🔴 Edge-Case #2 : Le Voyageur Ferry (Last-Minute, 10kg)

**Persona** : Mehdi, 41 ans, commerçant à Alger, fait le trajet Marseille-Alger en ferry SNCM avec sa voiture (3 fois par mois).

**Parcours détaillé :**

```
ÉTAPE 1 : PUBLICATION DE TRAJET (MODE "FERRY / VOITURE")
├─ Mehdi ouvre l'app → onglet "Je suis Voyageur"
├─ Type de trajet : FERRY Marseille-Alger
├─ Véhicule : OUI (voiture personnelle — Peugeot Partner)
├─ Détails du véhicule :
│   ├─ Immatriculation : non obligatoire (privacy), mais Type : Utilitaire
│   ├─ Volume disponible : Coffre ≈ 0.8 m³ (environ 10-12 kg de colis)
│   └─ Contraintes : Pas de produits inflammables, pas de taille > 50cm
├─ Dates :
│   ├─ Départ : Marseille (Port), 15 août 2026, embarquement 18h
│   ├─ Arrivée estimée : Alger (Port), 16 août, 10h (UTC+1)
│   └─ ⚠️ ALERTE FERRY : "Les traversées peuvent avoir 4-12h de retard.
│       Cochez 'Flexibilité +12h' pour augmenter vos chances de matching."
├─ Tarif demandé :
│   ├─ Tarif de base : 5 EUR/kg
│   ├─ Tarif négociable : OUI (min 3 EUR/kg)
│   ├─ Colis minimum accepté : 0.5 kg
│   └─ Cash accepté en plus de l'app : NON (règle anti-contournement)
├─ Mode "Last Minute" : OUI
│   └─ Notification push envoyée aux Senders avec des colis en attente
│       sur l'axe France → Alger dans les 48h
│
ÉTAPE 2 : MATCHING BULK (PLUSIEURS COLIS)
├─ L'algorithme propose 4 colis compatibles :
│   ├─ Colis A : Vêtements pour bébé, 2 kg, Alger Centre → Score 96
│   ├─ Colis B : Cosmétiques (chargeur, câbles), 1.5 kg, Hussein Dey → Score 88
│   ├─ Colis C : Documents notariés, 0.3 kg, Bir Mourad Raïs → Score 91
│   └─ Colis D : Échantillons médicaux, 3 kg, CHU Mustapha → Score 72
│       ⚠️ ALERT : Échantillons médicaux nécessitent une chaîne du froid
│       → Mehdi ne dispose pas de glacière → colis exclu du matching
│
├─ Mehdi accepte les colis A, B, C = 3.8 kg (reste 6.2 kg disponibles)
│
ÉTAPE 3 : LOGISTIQUE DE PRISE EN CHARGE (MULTI-SENDERS)
├─ Mehdi reçoit les 3 adresses de collecte :
│   ├─ Sender A : Lyon Part-Dieu (gare) — compatibilité trajet Marseille ⚠️
│   │   └─ Détour : +120 km → ALGORITHME calcule : détour acceptable < 200km ✅
│   ├─ Sender B : Marseille, 3e arrondissement → pas de détour ✅
│   └─ Sender C : Marseille, Vieux Port → pas de détour ✅
│
├─ Planning optimisé automatiquement :
│   ├─ 13h00 : Stop Lyon Part-Dieu (Sender A)
│   ├─ 15h30 : Stop Marseille 3e (Sender B)
│   ├─ 16h00 : Stop Vieux Port (Sender C)
│   └─ 18h00 : Embarquement ferry Marseille
│
├─ Mehdi valide le planning → notifications envoyées aux 3 Senders
│
ÉTAPE 4 : PRISE EN CHARGE MULTIPLE
├─ À chaque stop, Mehdi scanne le QR code de chaque colis
├─ L'app empêche Mehdi de partir si un colis n'est pas scanné
│   (sauf si Sender a annulé dans les 30 dernières minutes)
├─ Mehdi coche "Tous les colis chargés" → statut : "En transit"
│
ÉTAPE 5 : TRAVERSÉE FERRY + DÉDOUANEMENT
├─ Pendant la traversée (~18h), Mehdi reçoit un message proactif :
│   │   "Rappel : vous transportez 3 colis pour le compte de [Sender A, B, C].
│   │   Total poids : 3.8 kg. Valeur totale déclarée : 385 EUR.
│   │   En cas de contrôle douanier à l'arrivée, présentez les bordereaux
│   │   de déclaration générés dans l'app (onglet 'Mes Documents')."
│   ├─ Les bordereaux douaniers sont auto-générés :
│       ├─ Franchise voyageur : < 10,000 DZD par catégorie (voir Partie 4)
│       └─ Déclaration : "Effets personnels — cadeaux familiaux"
│
├─ Arrivée au Port d'Alger :
│   ├─ File douanière normale → pas de problème dans 90% des cas
│   └─ Si contrôle : Mehdi montre les bordereaux QR → douanier scanne → info affichée
│
ÉTAPE 6 : LIVRAISON MULTI-DESTINATIONS
├─ L'app optimise l'ordre de livraison à Alger (TSP simplifié) :
│   ├─ 11h30 : Hussein Dey (Colis B)
│   ├─ 12h15 : Alger Centre (Colis A)
│   └─ 13h00 : Bir Mourad Raïs (Colis C)
│
├─ Chaque livraison validée par OTP/PIN → déblocage progressif de l'Escrow
├─ Mehdi gagne : 3.8 kg × 5 EUR = 19 EUR (moins fee 10%) = 17.10 EUR net
│
ÉTAPE 7 : RÉTROACTION
├─ Les 3 Senders notent Mehdi → score mis à jour
├─ Mehdi est invité à noter les 3 Senders (emballage, ponctualité)
└─ Badge "Traveler Fiable" débloqué après 10 trajets sans litige
```

---

### 🔴 Edge-Case #3 : Envoi Domestique Tizi Ouzou → Tamanrasset

**Persona** : Amina, pharmacienne à Tizi Ouzou, doit envoyer des médicaments rares à son oncle à Tamanrasset (2,000 km, zones blanches réseau).

**Parcours détaillé :**

```
ÉTAPE 1 : CRÉATION D'ENVOI DOMESTIQUE
├─ Amina ouvre l'app → mode "Envoi Domestique"
├─ Colis : Médicaments (Insuline, nécessite conservation entre 2-8°C)
├─ Poids : 1.2 kg (dont 0.8 kg de glacière réutilisable)
├─ Valeur : 8,500 DZD (~55 EUR)
├─ Origine : Tizi Ouzou Centre (marché At Abdelmadjid)
│   └─ Système PIN activé + description textuelle :
│       "Magasin de téléphone à côté de la mosquée principale, face à la boulangerie"
├─ Destination : Tamanrasset, Quartier El Mokrani
│   └─ ⚠️ ALERTE ZONE BLANCHE :
│       "La destination est dans une zone à couverture réseau limitée.
│        Le voyageur devra se coordonner par téléphone au +213 XX XX XX XX
│        (pré-configuré dans les contacts du voyageur)."
│   └─ Point de livraison alternatif proposé : "Gare routière de Tamanrasset"
│       ou "Bureau de poste"
│   └─ Amina choisit : "Livraison à la gare routière + appel téléphonique"
├─ Urgence : MOYENNE (7 jours acceptable)
├─ Mode de paiement : DZD cash à la livraison par l'oncle
│   └─ ⚠️ Mode Cash-on-Delivery activé (voir Partie 3, Scénario B)
│
ÉTAPE 2 : MATCHING DOMESTIQUE
├─ Algorithme recherche Travelers faisant le trajet Nord → Sud :
│   ├─ Option A : Chauffeur de bus nocturne (Entreprise ETUV)
│       ├─ Départ Tizi Ouzou → Alger (gare) → Tamanrasset
│       ├─ Durée : ~36h de route
│       ├─ Score : 85 (bonne couverture, trajet régulier)
│       └─ Tarif : 2,000 DZD
│   ├─ Option B : Voyageur en camionnette (transport de marchandises)
│       ├─ Plus lent mais fiable, 2-3 jours
│       ├─ Score : 72
│       └─ Tarif : 1,500 DZD
│   └─ Option C : Militaire / fonctionnaire en mutation (régulier)
│       ├─ Score : 68 (historique limité)
│       └─ Tarif : 1,800 DZD
│
├─ Amina choisit le chauffeur de bus (Option A)
│
ÉTAPE 3 : PARTICULARITÉS DOMESTIQUES
├─ ⚠️ CHAÎNE DU FROID :
│   ├─ L'app impose une condition : "Ce colis nécessite un maintien à 2-8°C.
│       Seuls les Travelers ayant coché 'Glacière disponible' peuvent accepter."
│   ├─ Le chauffeur confirme avoir une glacière (coché dans son profil)
│   └─ Capteur de température NFC optionnel (si disponible) :
│       Glacière équipée d'un tag NFC → le voyageur scanne toutes les 4h
│       → Température enregistrée dans la blockchain du colis
│
├─ MODE OFFLINE :
│   ├─ L'app pré-charge le trajet complet en mode hors-ligne
│   ├─ Codes OTP générés à l'avance (pas besoin de réseau pour valider)
│   └─ En cas de coupure réseau, l'app permet la validation via SMS USSD
│       (partenariat avec Mobilis/Djezzy)
│
ÉTAPE 4 : LIVRAISON EN ZONE BLANCHE
├─ Le chauffeur arrive à la gare routière de Tamanrasset (36h plus tard)
├─ Appel téléphonique à l'oncle : "Votre colis est à la gare"
├─ L'oncle arrive → il n'a PAS l'app (pas de smartphone)
│   └─ MODE "RÉCEPTION SANS APP" :
│       ├─ L'oncle donne un code secret communiqué par téléphone par Amina
│       ├─ Le chauffeur saisit le code → validation
│       ├─ Le chauffeur saisit "2000 DZD reçus en cash" → confirmation
│       └─ Statut : "Livré + Paiement Cash Confirmé"
│
ÉTAPE 5 : DÉBLOCAGE PAIEMENT
├─ L'argent cash est conservé par le chauffeur (physique)
├─ L'app enregistre la transaction COD comme "Complétée"
├─ Le chauffeur doit remettre les 2,000 DZD à un agent CrowdShipping
│   (Point relais à Alger ou à Tamanrasset) sous 48h
│   └─ Agent vérifie l'OTP de remise
├─ Fee plateforme (10%) : 200 DZD déduits
├─ 1,800 DZD crédités au wallet CrowdShipping du chauffeur
│   (retirable via CCP ou agent)
```

---

## 1.3 Système d'Adressage "Fallback" (Algérie)

### 1.3.1 Le Problème

L'Algérie ne dispose pas d'un système d'adressage standardisé comparable à la France ou aux USA. Les réalités terrain :

| Problème | Exemple | Fréquence |
|----------|---------|------------|
| **Pas de numéros de rue** | "Rue à côté de la mosquée" | ~70% des adresses rurales |
| **Tos noms non officiels** | "Cité 1000 Logements, Bâtiment 4, Escalier B" | ~40% en zone urbaine |
| **Zones non cartographiées** | Villages kabyles, ksour sahariens | ~30% du territoire |
| **Changement de noms de rues** | "Ex-Rue Didouche Mourad" vs "Rue Larbi Ben M'hidi" | ~25% (post-1962) |
| **Absence de code postal fiable** | Plusieurs quartiers partagent le même code postal | ~35% |

### 1.3.2 Architecture du Système d'Adressage CrowdShipping

Le système est structuré en **4 niveaux de fallback** (du plus précis au moins précis) :

```
┌─────────────────────────────────────────────────────────────────┐
│                CROWDSHIPPING ADDRESSING SYSTEM                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LEVEL 1 : GEOCODER OFFICIEL (priorité)                         │
│  ├─ Utilise Google Maps Geocoding API + OpenStreetMap           │
│  ├─ Algérie Post code lookup (API Poste Algérienne si dispo)    │
│  └─ Résultat : lat/lng exact + adresse formatée                 │
│                                                                 │
│  LEVEL 2 : PIN LOCATION SYSTEM (si Level 1 échoue)               │
│  ├─ Sender clique sur une carte interactive (Mapbox)            │
│  ├─ Un PIN ( marqueur ) est placé à l'endroit exact              │
│  ├─ Rayon de confiance : 50m                                   │
│  ├─ + Description textuelle libre ("à côté du marché", etc.)   │
│  └─ + Photo du point de repère (optionnel mais recommandé)     │
│                                                                 │
│  LEVEL 3 : POI-BASED (Points of Interest)                        │
│  ├─ Base de données POI propriétaire, enrichie communautaire : │
│  │   ├─ Mosquées (1300+ références en Algérie)                  │
│  │   ├─ Stations-service (Sonatrach, Naftal)                    │
│  │   ├─ Écoles, lycées, universités                             │
│  │   ├─ Marchés, souks                                          │
│  │   ├─ Gares routières, aéroports, ports                      │
│  │   ├─ Pharmacies                                             │
│  │   ├─ Bureaux de poste                                       │
│  │   └─ Points relais partenaires                               │
│  ├─ Format : "À 200m de la Mosquée Ibn Badis, vers le nord"     │
│  └─ Auto-complétion basée sur la localisation actuelle          │
│                                                                 │
│  LEVEL 4 : LIVE-LOCATION SHARING                                │
│  ├─ Quand le Traveler est à < 5 km de la destination :         │
│  ├─ Activation du mode "Live Location" dans le chat             │
│  ├─ Partage de position en temps réel pendant 30 min            │
│  ├─ Le Receiver peut guider le Traveler par appel vocal         │
│  └─ Le Sender reçoit : "Votre colis est à 2.3 km de la livr."   │
│                                                                 │
│  LEVEL 5 : HUMAN RELAY (ultime fallback)                        │
│  ├─ Point relais physique (kiosque, bureau de poste, épicier)  │
│  ├─ Le Receiver vient chercher le colis au point relais         │
│  ├─ Validé par OTP communiqué par téléphone                     │
│  └─ Réseau initial : 200 points relais dans 15 wilayas          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3.3 Format d'Adresse CrowdShipping (JSON Schema)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "title": "CrowdShippingAddress",
  "properties": {
    "addressId": { "type": "string", "format": "uuid" },
    "level": {
      "type": "integer",
      "enum": [1, 2, 3, 4, 5],
      "description": "Fallback level used (1=official, 5=human relay)"
    },
    "country": { "type": "string", "const": "DZ" },
    "wilaya": {
      "type": "string",
      "description": "Code wilaya (ex: '16' pour Alger)"
    },
    "commune": {
      "type": "string",
      "description": "Nom de la commune (ex: 'Sidi M'Hamed')"
    },
    "geocode": {
      "type": "object",
      "properties": {
        "lat": { "type": "number" },
        "lng": { "type": "number" },
        "accuracyMeters": { "type": "number" },
        "source": { "type": "string", "enum": ["google", "osm", "pin_drop", "poi", "estimated"] }
      }
    },
    "streetDescription": {
      "type": "string",
      "description": "Description libre en français/arabe (ex: '3ème rue après la mosquée, bleu')"
    },
    "nearestPOI": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["mosque", "gas_station", "school", "market", "pharmacy", "post_office", "relay_point"] },
        "name": { "type": "string" },
        "distanceMeters": { "type": "number" },
        "direction": { "type": "string", "enum": ["north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest"] }
      }
    },
    "landmarkPhoto": {
      "type": "string",
      "format": "uri",
      "description": "Photo du point de repère uploadée par le Sender"
    },
    "relayPointId": {
      "type": ["string", "null"],
      "description": "ID du point relais si Level 5 utilisé"
    },
    "recipientPhone": {
      "type": "string",
      "pattern": "^\\+213[5-7][0-9]{8}$",
      "description": "Numéro de téléphone du destinataire (format algérien)"
    },
    "deliveryInstructions": {
      "type": "string",
      "maxLength": 500,
      "description": "Instructions spéciales (ex: 'Sonner 2 fois, demander Mohammed')"
    }
  },
  "required": ["addressId", "level", "country", "wilaya", "commune", "geocode"]
}
```

---

## 1.4 Algorithme de Matching

### 1.4.1 Formulation Mathématique

Le score de matching entre un colis `p` (parcel) et un voyageur `t` (traveler) est calculé comme suit :

```
Score(p, t) = w₁·S_route(t, p)  +  w₂·S_capacity(t, p)  +  w₃·S_trust(t, p)
             +  w₄·S_urgency(t, p) +  w₅·S_compatibility(t, p) +  w₆·S_price(t, p)
             +  w₇·S_history(t, p) +  w₈·S_risk(t, p)
```

Où chaque sous-score est normalisé dans [0, 1] :

| Pondération | Sous-Score | Formule | Description |
|-------------|-----------|---------|-------------|
| w₁ = 0.20 | `S_route` | `1 - (detour_km / max_acceptable_detour_km)` | Détour kilométrique accepté par le voyageur |
| w₂ = 0.15 | `S_capacity` | `(capacity_remaining - parcel_weight) / capacity_remaining` | Capacité restante après ajout du colis |
| w₃ = 0.20 | `S_trust` | `(trust_score_traveler / 100)` | Score de confiance global du voyageur |
| w₄ = 0.10 | `S_urgency` | `1 if (arrival_time < urgency_deadline) else 0` | Le voyageur arrive-t-il dans les délais ? |
| w₅ = 0.08 | `S_compatibility` | Fonction de compatibilité catégorie colis ↔ expérience voyageur | Le voyageur a-t-il déjà transporté ce type de colis ? |
| w₆ = 0.12 | `S_price` | `1 - abs(traveler_price - sender_budget) / sender_budget` | Adéquation prix demandé / budget |
| w₇ = 0.10 | `S_history` | `successful_past_deliveries / total_past_deliveries` | Taux de réussite historique |
| w₈ = 0.05 | `S_risk` | `1 - fraud_risk_score` | Score anti-fraude (0 = risque max, 1 = pas de risque) |

**Note** : Les poids (w₁...w₈) sont ajustables via un système A/B testing et un modèle de régression logistique entraîné sur les transactions réussies/échouées.

### 1.4.2 Pseudo-Code de l'Algorithme

```python
def compute_matching_score(parcel: Parcel, traveler: Traveler) -> float:
    """
    Calcule le score de matching entre un colis et un voyageur.
    Retourne un score entre 0 (incompatible) et 100 (parfait).
    Un score < 30 est considéré comme "non recommandé".
    """

    # --- FILTERS (Hard Constraints — élimination directe) ---
    if traveler.status != "VERIFIED":
        return 0.0
    if traveler.capacity_remaining_kg < parcel.weight_kg:
        return 0.0
    if traveler.departure_time > parcel.urgency_deadline:
        return 0.0
    if parcel.category in traveler.blocked_categories:
        return 0.0
    if is_route_compatible(traveler.route, parcel.origin, parcel.destination) == False:
        return 0.0

    # --- SOFT SCORING ---

    # S_route : Détour kilométrique
    base_route_km = compute_route_distance(
        traveler.origin, traveler.destination
    )
    detour_km = compute_route_distance(
        traveler.origin, parcel.pickup_location,
        traveler.destination, parcel.delivery_location,
        mode="via_waypoints"
    ) - base_route_km

    max_detour = traveler.max_acceptable_detour_km  # configurable par le voyageur
    S_route = max(0, 1 - (detour_km / max_detour)) if max_detour > 0 else 0

    # S_capacity : Capacité restante
    S_capacity = (traveler.capacity_remaining_kg - parcel.weight_kg) / traveler.capacity_remaining_kg

    # S_trust : Score de confiance composite
    S_trust = (
        0.4 * (traveler.kyc_level / 3) +          # Niveau KYC (1=basic, 2=enhanced, 3=full)
        0.3 * (traveler.reputation_score / 100) +   # Score de réputation
        0.2 * min(1, traveler.completed_trips / 20) + # Bonus d'expérience (plafonné à 20 trajets)
        0.1 * (1 if traveler.has_active_insurance else 0)  # Assurance active
    )

    # S_urgence : Respect du délai
    estimated_arrival = traveler.departure_time + traveler.estimated_travel_duration
    buffer_hours = 6  # Marge de sécurité de 6h
    S_urgency = 1.0 if estimated_arrival <= parcel.urgency_deadline - timedelta(hours=buffer_hours) else (
        0.5 if estimated_arrival <= parcel.urgency_deadline else 0.0
    )

    # S_compatibility : Expérience avec ce type de colis
    past_similar = traveler.get_deliveries_by_category(parcel.category)
    total_deliveries = traveler.total_completed_deliveries
    S_compatibility = min(1.0, past_similar / max(1, total_deliveries)) * 0.5 + 0.5  # min 0.5

    # S_price : Adéquation prix
    price_diff = abs(traveler.asked_price_eur - parcel.sender_budget_eur)
    S_price = max(0, 1 - (price_diff / parcel.sender_budget_eur)) if parcel.sender_budget_eur > 0 else 0.5

    # S_history : Taux de réussite
    S_history = traveler.success_rate if total_deliveries > 0 else 0.5  # Neutral pour nouveaux

    # S_risk : Score anti-fraude (0-1, 1=sûr)
    risk_signals = compute_fraud_risk(parcel, traveler)
    S_risk = 1.0 - risk_signals

    # --- WEIGHTED COMBINATION ---
    score = (
        0.20 * S_route +
        0.15 * S_capacity +
        0.20 * S_trust +
        0.10 * S_urgency +
        0.08 * S_compatibility +
        0.12 * S_price +
        0.10 * S_history +
        0.05 * S_risk
    )

    return round(score * 100, 1)  # Score final entre 0 et 100


def get_top_matches(parcel: Parcel, limit: int = 5) -> list[MatchResult]:
    """
    Récupère les meilleurs matchs pour un colis donné.
    Utilise un index géospatial (PostGIS / Redis GEO) pour filtrer
    rapidement les voyageurs dans un rayon pertinent.
    """
    # Étape 1 : Filtrage géographique préliminaire
    candidate_travelers = geo_query_nearby_travelers(
        origin=parcel.pickup_location,
        destination=parcel.delivery_location,
        time_window=(parcel.created_at, parcel.urgency_deadline),
        max_results=200
    )

    # Étape 2 : Scoring complet
    scored = []
    for traveler in candidate_travelers:
        score = compute_matching_score(parcel, traveler)
        if score >= 30.0:  # Seuil minimum
            scored.append(MatchResult(
                traveler=traveler,
                score=score,
                estimated_price=traveler.asked_price_eur,
                estimated_arrival=traveler.departure_time + traveler.estimated_travel_duration,
                detour_km=compute_detour(traveler, parcel)
            ))

    # Étape 3 : Tri par score décroissant
    scored.sort(key=lambda x: x.score, reverse=True)

    return scored[:limit]
```

---

## 1.5 Système de Scoring de Confiance

### 1.5.1 Facteurs de Score

| Signal | Poids | Source | Description |
|--------|-------|--------|-------------|
| Niveau KYC | 20% | Onfido/Sumsub | Vérification identité (basic/enhanced/full) |
| Nombre de trajets complétés | 15% | Base de données | Plus de trajets = plus de confiance |
| Taux de réussite | 20% | Base de données | (livrés sans litige) / (total acceptés) |
| Notes moyennes | 15% | Avis utilisateurs | Moyenne des étoiles reçues |
| Ancienneté du compte | 5% | Base de données | Compte de > 6 mois = bonus |
| Vérification téléphone | 5% | Twilio/Verify | Numéro vérifié par SMS |
| Presence assurance | 10% | Partenaire assureur | A souscrit une assurance trajet |
| Badge vérifié (idéal) | 5% | Admin | Vérification manuelle par l'équipe |
| Sanctions | -100 | Admin | Tout litige non résolu = pénalité |

### 1.5.2 Niveaux de Confiance

| Niveau | Score | Badge | Avantages |
|--------|-------|-------|-----------|
| **Bronze** | 0-39 | 🥉 Aucun | Matching limité, garanties réduites |
| **Argent** | 40-69 | 🥈 Vérifié | Matching prioritaire, accès COD domestique |
| **Or** | 70-89 | 🥇 Fiable | Priorité maximale, badge visible, assurance préférentielle |
| **Platine** | 90-100 | 💎 Ambassadeur | Fee réduite (7% au lieu de 10%), support dédié, programme de parrainage premium |

---

# PARTIE 2 : Architecture Technique & Stack

## 2.1 Architecture Système Globale

```mermaid
graph TB
    subgraph "CLIENTS"
        MOBILE_IOS[iOS App<br/>React Native]
        MOBILE_ANDROID[Android App<br/>React Native]
        WEB_ADMIN[Admin Dashboard<br/>Next.js]
    end

    subgraph "API GATEWAY"
        KONG[Kong Gateway<br/>Rate Limiting, Auth, Routing]
    end

    subgraph "MICROSERVICES"
        AUTH[Auth Service<br/>JWT + OAuth2.0]
        USER[User Service<br/>KYC, Profiles, Scoring]
        MATCHING[Matching Service<br/>GeoQuery, Scoring Algo]
        TRIP[Trip Service<br/>CRUD Trips, Tracking]
        PARCEL[Parcel Service<br/>CRUD Parcels, Photos]
        ESCROW[Escrow Service<br/>Payment Orchestration]
        CHAT[Chat Service<br/>WebSocket, Encryption]
        NOTIF[Notification Service<br/>Push, SMS, Email]
        DOUANE[Customs Service<br/>Declaration, Compliance]
        DISPUTE[Dispute Service<br/>Mediation, Resolution]
        ANALYTICS[Analytics Service<br/>Metrics, BI]
    end

    subgraph "EVENT BUS"
        KAFKA[Apache Kafka<br/>Event Streaming]
    end

    subgraph "DATA LAYER"
        POSTGRES[(PostgreSQL 16<br/>Primary DB + PostGIS)]
        REDIS[(Redis 7<br/>Cache + Geo Queries)]
        MONGO[(MongoDB<br/>Chat Messages + Logs)]
        S3[Amazon S3<br/>Photos + Documents]
        ELASTIC[Elasticsearch<br/>Search + Analytics)]
    end

    subgraph "EXTERNAL SERVICES"
        KYC_PROVIDER[Onfido / Sumsub<br/>KYC]
        PAYMENT_STRIPE[Stripe<br/>EUR Payments]
        PAYMENT_LEMON[LemonWay<br/>Escrow Wallets]
        SMS_TWILIO[Twilio / SMSLocal<br/>SMS Gateway]
        MAPS_MAPBOX[Mapbox / Google Maps<br/>Geocoding]
        PUSH_FCM[FCM / APNS<br/>Push Notifications]
        INSURANCE[AXA / AssurTech<br/>Insurance API]
    end

    MOBILE_IOS --> KONG
    MOBILE_ANDROID --> KONG
    WEB_ADMIN --> KONG

    KONG --> AUTH
    KONG --> USER
    KONG --> MATCHING
    KONG --> TRIP
    KONG --> PARCEL
    KONG --> ESCROW
    KONG --> CHAT
    KONG --> NOTIF
    KONG --> DOUANE
    KONG --> DISPUTE
    KONG --> ANALYTICS

    AUTH --> KAFKA
    USER --> KAFKA
    MATCHING --> KAFKA
    TRIP --> KAFKA
    PARCEL --> KAFKA
    ESCROW --> KAFKA
    CHAT --> KAFKA
    NOTIF --> KAFKA

    AUTH --> POSTGRES
    AUTH --> REDIS
    USER --> POSTGRES
    USER --> MONGO
    MATCHING --> POSTGIS_SOLVED[PostGIS<br/>Geo Extensions]
    MATCHING --> REDIS
    TRIP --> POSTGRES
    TRIP --> REDIS
    PARCEL --> POSTGRES
    PARCEL --> S3
    CHAT --> MONGO
    CHAT --> REDIS
    NOTIF --> REDIS
    DOUANE --> POSTGRES
    DISPUTE --> POSTGRES
    ANALYTICS --> ELASTIC

    USER --> KYC_PROVIDER
    ESCROW --> PAYMENT_STRIPE
    ESCROW --> PAYMENT_LEMON
    NOTIF --> SMS_TWILIO
    NOTIF --> PUSH_FCM
    MATCHING --> MAPS_MAPBOX
    ESCROW --> INSURANCE
```

## 2.2 Schéma de Base de Données (Prisma)

```prisma
// ============== ENUMS ==============

enum UserRole {
  SENDER
  TRAVELER
  BOTH
  ADMIN
  AGENT
}

enum KYCLevel {
  NONE
  BASIC       // Phone + Email verified
  ENHANCED    // ID document + Selfie
  FULL        // Enhanced + Proof of address + Video call
}

enum TripMode {
  FLIGHT
  FERRY
  BUS
  CAR
  TRUCK
  TRAIN
}

enum TripStatus {
  DRAFT
  PUBLISHED
  MATCHING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum ParcelStatus {
  DRAFT
  PENDING_MATCH
  MATCHED
  AWAITING_PICKUP
  IN_TRANSIT
  CUSTOMS_CHECK
  AWAITING_DELIVERY
  DELIVERED
  DISPUTED
  CANCELLED
  SEIZED
}

enum EscrowStatus {
  FUNDED
  LOCKED
  PARTIAL_RELEASE
  RELEASED
  REFUNDED_SENDER
  REFUNDED_INSURANCE
}

enum DisputeStatus {
  OPENED
  MEDIATING
  ESCALATED
  RESOLVED
  CLOSED
}

enum DisputeReason {
  PARCEL_NOT_DELIVERED
  PARCEL_DAMAGED
  PARCEL_STOLEN
  CUSTOMS_SEIZURE
  TRAVELER_NO_SHOW
  SENDER_NO_SHOW
  FRAUD_ATTEMPT
  OTHER
}

enum Currency {
  EUR
  DZD
  USD
  CAD
  GBP
}

enum PaymentMethod {
  CREDIT_CARD_STRIPE
  LEMONWAY_WALLET
  CASH_ON_DELIVERY
  BANK_TRANSFER
  CCP_TRANSFER
  BARIDI_MOB
}

enum AddressLevel {
  OFFICIAL_GEOCODE
  PIN_DROP
  POI_BASED
  LIVE_LOCATION
  HUMAN_RELAY
}

// ============== MODELS ==============

model User {
  id              String     @id @default(uuid())
  email           String     @unique
  phone           String     @unique // Format: +213XXXXXXXXX ou +33XXXXXXXXX
  passwordHash    String     @db.VarChar(255)
  firstName       String     @db.VarChar(100)
  lastName        String     @db.VarChar(100)
  displayName     String?    @db.VarChar(100)
  avatarUrl       String?    // S3 URL
  role            UserRole   @default(BOTH)
  kycLevel        KYCLevel   @default(NONE)
  kycVerifiedAt   DateTime?
  kycDocumentUrl  String?    // S3 URL

  // Trust Scoring
  trustScore      Int        @default(0)     // 0-100
  completedTrips  Int        @default(0)
  completedDeliveries Int    @default(0)
  successRate     Float      @default(0)      // 0.0 - 1.0
  averageRating   Float      @default(0)      // 0.0 - 5.0
  trustBadge      String?    // "BRONZE", "SILVER", "GOLD", "PLATINUM"
  isBanned        Boolean    @default(false)
  bannedAt        DateTime?
  bannedReason    String?

  // Preferences
  blockedCategories String[] // ["Drones", "Weapons", ...]
  maxDetourKm      Int?     // Acceptable detour for matching
  preferredCurrency Currency @default(EUR)

  // Meta
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  lastLoginAt     DateTime?
  deviceTokens    String[]   // FCM/APNS tokens

  // Relations
  sentParcels     Parcel[]   @relation("Sender")
  travelerTrips   Trip[]     @relation("Traveler")
  ratingsGiven    Rating[]
  ratingsReceived Rating[]
  disputes        Dispute[]
  escrowAccounts  EscrowLedger[]
  notifications   Notification[]
}

model Trip {
  id              String       @id @default(uuid())
  travelerId      String
  traveler        User         @relation("Traveler", fields: [travelerId], references: [id])

  // Route
  origin          Json         // CrowdShippingAddress format
  destination     Json         // CrowdShippingAddress format
  routePolyline   String?      // Encoded polyline for map display
  totalDistanceKm  Float
  estimatedDurationHours Float?

  // Schedule
  departureTime   DateTime
  estimatedArrival DateTime?
  actualArrival   DateTime?
  mode            TripMode
  isFlexPlus12h   Boolean      @default(false) // Ferry flexibility

  // Capacity
  vehicleType     String?      // "Voiture", "Utilitaire", "Camion", "À pied"
  maxWeightKg     Float
  maxVolumeM3     Float?
  currentWeightKg Float        @default(0) // Updated as parcels are assigned
  maxDetourKm     Int          @default(50)

  // Pricing
  pricePerKg      Float?       // EUR or DZD
  priceCurrency   Currency     @default(EUR)
  isNegotiable    Boolean      @default(true)
  minPricePerKg   Float?       // Minimum acceptable price

  // Status
  status          TripStatus   @default(DRAFT)
  publishedAt     DateTime?

  // Metadata
  notes           String?      @db.Text
  hasCooler       Boolean      @default(false) // For cold chain parcels
  acceptsFragile  Boolean      @default(false)

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Relations
  parcels         Parcel[]     @relation("Trip")
  checkpoints     TripCheckpoint[]
}

model TripCheckpoint {
  id              String    @id @default(uuid())
  tripId          String
  trip            Trip      @relation(fields: [tripId], references: [id])
  type            String    @enum("PICKUP", "DEPARTURE", "TRANSIT", "CUSTOMS", "ARRIVAL", "DELIVERY")
  location        Json      // {lat, lng, address, timestamp}
  notes           String?
  photoUrl        String?   // S3
  temperatureC    Float?    // For cold chain
  createdAt       DateTime  @default(now())
}

model Parcel {
  id              String       @id @default(uuid())
  senderId        String
  sender          User         @relation("Sender", fields: [senderId], references: [id])

  // Content
  description     String       @db.Text
  category        String       // "Electronics", "Clothing", "Medicine", "Documents", "Food", "Cosmetics", "Other"
  subCategory     String?
  weightKg        Float
  dimensionsCm    Json         // {length, width, height}
  estimatedValue  Decimal      @db.Decimal(12,2)
  valueCurrency   Currency     @default(EUR)
  photoUrls       String[]     // S3 URLs (max 5)
  invoiceUrl      String?      // S3 URL (optional proof of purchase)

  // Route
  pickupAddress   Json         // CrowdShippingAddress
  deliveryAddress Json         // CrowdShippingAddress
  pickupNotes     String?      @db.Text
  deliveryNotes   String?      @db.Text
  deliveryPin     String?      @db.VarChar(6) // 6-digit PIN for delivery validation

  // Urgency
  urgencyLevel    String       @enum("LOW", "MEDIUM", "HIGH", "CRITICAL")
  urgencyDeadline DateTime?

  // Insurance
  hasInsurance    Boolean      @default(false)
  insurancePremium Decimal?    @db.Decimal(10,2)
  coverageAmount  Decimal?     @db.Decimal(12,2)

  // Pricing
  offeredPrice    Decimal?     @db.Decimal(10,2) // Price sender is willing to pay
  priceCurrency   Currency     @default(EUR)

  // Status
  status          ParcelStatus @default(DRAFT)
  matchedTripId   String?      // FK to Trip (nullable until matched)
  matchedAt       DateTime?

  // Customs
  customsCategory String?      // Douane category code
  requiresDeclaration Boolean   @default(false)
  customsDeclarationId String?

  // Recipient (if not the sender)
  recipientName   String?
  recipientPhone  String?      // Format: +213XXXXXXXXX
  recipientHasApp Boolean      @default(false)

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Relations
  trip            Trip?        @relation("Trip", fields: [matchedTripId], references: [id])
  escrow          EscrowLedger?
  dispute         Dispute?
  ratings         Rating[]
  customsLog      CustomsClearanceLog?
}

model EscrowLedger {
  id              String       @id @default(uuid())
  parcelId        String       @unique
  parcel          Parcel       @relation(fields: [parcelId], references: [id])
  senderId        String
  travelerId      String
  status          EscrowStatus

  // Amounts
  totalAmount     Decimal      @db.Decimal(12,2)
  currency        Currency
  platformFee     Decimal      @db.Decimal(10,2)  // 10% default
  insuranceFee    Decimal?     @db.Decimal(10,2)
  travelerPayout  Decimal      @db.Decimal(10,2)  // Amount traveler receives

  // Payment flow
  fundingMethod   PaymentMethod
  payoutMethod    PaymentMethod?

  // Timestamps
  fundedAt        DateTime?
  lockedAt        DateTime?
  releasedAt      DateTime?
  refundedAt      DateTime?

  // External references
  stripePaymentIntentId String?
  lemonwayWalletId     String?
  lemonwayTransactionId String?

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model Dispute {
  id              String        @id @default(uuid())
  parcelId        String        @unique
  parcel          Parcel        @relation(fields: [parcelId], references: [id])
  openedBy        String        // userId who opened the dispute
  openedById      User          @relation(fields: [openedById], references: [id])
  reason          DisputeReason
  description     String        @db.Text

  // Evidence
  evidenceUrls    String[]      // S3 URLs (photos, videos, screenshots)
  chatTranscript  String?       @db.Text // In-app chat export

  // Resolution
  status          DisputeStatus @default(OPENED)
  resolution      String?       @db.Text
  resolvedBy      String?       // Admin userId
  resolvedAt      DateTime?
  refundAmount    Decimal?      @db.Decimal(10,2)
  insuranceClaim  Boolean       @default(false)

  // SLA
  mustResolveBy   DateTime      // 72h from opening
  escalatedAt     DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model CustomsClearanceLog {
  id              String    @id @default(uuid())
  parcelId        String    @unique
  parcel          Parcel    @relation(fields: [parcelId], references: [id])
  checkpoint      String    @enum("DEPARTURE_COUNTRY", "ALGERIAN_BORDER", "SEIZED", "CLEARED", "FINE_PAID")

  // Declaration details
  declaredCategory String
  declaredValue    Decimal   @db.Decimal(12,2)
  declaredCurrency Currency
  franchiseApplied Boolean    @default(false)

  // If seized
  seizedBy         String?   // "Douanes Algériennes - Aéroport Houari Boumédiène"
  seizureReason    String?   @db.Text
  seizureDate      DateTime?
  fineAmount       Decimal?  @db.Decimal(10,2)

  // Traveler notes
  travelerNotes    String?   @db.Text

  createdAt        DateTime  @default(now())
}

model Rating {
  id              String    @id @default(uuid())
  parcelId        String
  parcel          Parcel    @relation(fields: [parcelId], references: [id])
  fromUserId      String
  toUserId        String
  score           Int       // 1-5
  comment         String?   @db.Text
  createdAt       DateTime  @default(now())

  @@unique([fromUserId, toUserId, parcelId])
}

model Notification {
  id              String    @id @default(uuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  type            String    // "MATCH_FOUND", "PARCEL_PICKED_UP", "IN_TRANSIT", etc.
  title           String
  body            String    @db.Text
  data            Json?     // Additional payload
  isRead          Boolean   @default(false)
  sentVia         String[]  // ["push", "sms", "email", "in_app"]
  createdAt       DateTime  @default(now())
}

// ============== INDEXES ==============

// Geo queries for matching
model GeoIndex {
  id          String    @id @default(uuid())
  entityType  String    @enum("trip_origin", "trip_destination", "parcel_pickup", "parcel_delivery")
  entityId    String
  location    Json      // {lat, lng}
  updatedAt   DateTime  @updatedAt
  @@index([entityType, location], name: "geo_spatial_idx")
}
```

## 2.3 Stack Technologique Recommandée

| Couche | Technologie | Justification |
|--------|------------|---------------|
| **Mobile Frontend** | React Native + Expo (SDK 52+) | Un codebase iOS + Android, large communauté, over-the-air updates |
| **Web Admin** | Next.js 15 (App Router) | SSR, API routes intégrées, excellent DX |
| **UI Library (Mobile)** | NativeWind v4 (Tailwind pour RN) | Consistance visuelle, rapidité de dev |
| **UI Library (Admin)** | shadcn/ui + Radix | Accessibilité native, composants non-opinionnés |
| **API Gateway** | Kong (open-source) | Rate limiting, auth JWT, plugins |
| **Backend - Core** | Node.js (TypeScript) + Fastify | Performance, typage fort, écosystème riche |
| **Backend - Matching** | Rust (Actix-web) ou Go | Calcul géospatial critique, latence < 50ms |
| **Backend - Chat** | Node.js + Socket.IO | WebSocket temps réel |
| **Event Bus** | Apache Kafka (Confluent Cloud) | Event sourcing, replay, scalabilité |
| **Primary Database** | PostgreSQL 16 + PostGIS | ACID, extensions géospatiales natives |
| **Cache / Geo** | Redis 7 (Redis Stack) | Cache, géo-requêtes (GEOADD/GEORADIUS), pub/sub |
| **Chat Storage** | MongoDB Atlas | Flexibilité schéma messages, sharding natif |
| **Search** | Elasticsearch 8 | Recherche full-text, analytics, aggregations |
| **Object Storage** | AWS S3 (ou Wasabi pour le coût) | Photos, documents, factures |
| **CDN** | CloudFront | Distribution images/carte mondiale |
| **KYC** | Sumsub (préféré) ou Onfido | Support CNI/Passport algérien, OCR arabe/français |
| **Maps / Geocoding** | Mapbox GL JS + Geocoding API | Offline maps support, coût inférieur à Google, couverture Algérie correcte |
| **SMS Gateway** | Twilio (international) + Mobilis SMS API (local) | International = Twilio, local = API opérateur algérien |
| **Payment (EUR)** | Stripe (carte) + LemonWay (wallet/escrow) | Stripe = UX CB, LemonWay = conformité PSD2, KYC bancaire |
| **Payment (DZD)** | BaridiMob (Algérie Post) + SATIM/CIB (si possible) | CCP/Baridimob = 90% des comptes algériens |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Gratuit, fiable, multi-plateforme |
| **Email** | AWS SES | Transactionnel, coût bas |
| **CI/CD** | GitHub Actions + EAS (Expo) + Docker | Pipeline automatisé, déploiement continu |
| **Monitoring** | Datadog (ou Grafana + Prometheus) | APM, logs, métriques temps réel |
| **Error Tracking** | Sentry | Stack traces, breadcrumbs, alertes |
| **Infrastructure** | AWS (eu-west-3 Paris) + OVHcloud (Algérie CDN) | Paris = faible latence Europe, OVH = POP Algérie |

## 2.4 Sécurité & Anti-Fraude

### 2.4.1 Vecteurs d'Attaque et Contre-Mesures

| Attaque | Description | Contre-Mesure |
|---------|-------------|---------------|
| **Vol de colis** | Traveler disparaît avec le colis | Escrow bloqué, KYC complet obligatoire, garantie dépôt (200 EUR min pour Travelers actifs), suivi GPS in-app |
| **Fausses annonces** | Sender crée des envois fictifs pour blanchir de l'argent | Limite mensuelle de valeur par sender, verification factures, pattern detection ML (plusieurs envois identiques) |
| **Blanchiment d'argent** | Utilisation de l'escrow pour mouvements d'argent illégaux | KYC renforcé (Sumsub), monitoring transactions > 1,000 EUR, reporting TRACFIN si seuil dépassé, limite de transactions par utilisateur |
| **Ghost travelers** | Travelers fantômes qui acceptent mais ne se présentent pas | Système de dépôt/garantie, pénalités pour no-show (suspension progressive), confirmation GPS au point de pickup |
| **Identity theft** | Utilisation de faux documents KYC | Liveness detection (video selfie), cross-check bases de données, détection deepfake |
| **Man-in-the-middle** | Interception de l'OTP/PIN | OTP à usage unique, TTL de 5 minutes, generation server-side uniquement, pas de transmission par canal non-sécurisé |
| **Colis interdits** | Envoi de produits prohibés (drogues, armes, drones) | AI classification des images de colis, base de données produits interdits (douane algérienne), blocage programmatique par catégorie |

### 2.4.2 Architecture de Sécurité

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 1 : TRANSPORT SECURITY                                  │
│  ├─ TLS 1.3 sur toutes les communications                      │
│  ├─ Certificate pinning sur l'app mobile                      │
│  ├─ VPN interne pour les services backend (mTLS)                │
│  └─ Rate limiting : 100 req/min par IP, 30 req/min par user    │
│                                                                 │
│  LAYER 2 : AUTHENTICATION & AUTHORIZATION                      │
│  ├─ JWT (access 15 min + refresh 7 days)                      │
│  ├─ OAuth2.0 + PKCE pour le login mobile                        │
│  ├─ MFA optionnel (TOTP via Google Authenticator)               │
│  ├─ RBAC strict : SENDER, TRAVELER, ADMIN, AGENT                │
│  └─ Device fingerprinting pour détecter les comptes multiples   │
│                                                                 │
│  LAYER 3 : DATA PROTECTION                                      │
│  ├─ Chiffrement AES-256 au repos (PostgreSQL pgcrypto)          │
│  ├─ Chiffrement E2E des messages chat (Signal Protocol)         │
│  ├─ PII masking dans les logs (GDPR/loi algérienne 18-05)       │
│  ├─ Rétention : données effaçables après 3 ans (sauf legal)    │
│  └- Backup chiffré cross-region (Paris + Frankfurt)            │
│                                                                 │
│  LAYER 4 : ANTI-FRAUD ENGINE                                    │
│  ├─ Modèle ML (XGBoost) pour scoring de risque en temps réel     │
│  ├─ Signaux : device fingerprint, IP géoloc, comportement chat  │
│  ├─ Règles statiques : max 5 envois/jour, max 3,000 EUR/mois   │
│  ├─ Liste noire partagée (consortium fraud)                     │
│  └─ Alertes automatiques au compliance team                     │
│                                                                 │
│  LAYER 5 : PHYSICAL SECURITY                                    │
│  ├- OTP à usage unique (6 chiffres, TTL 5 min)                 │
│  ├- QR code signé (HMAC-SHA256) pour validation remise          │
│  ├- Photo obligatoire à pickup + delivery (horodatée, geo)    │
│  └- Enregistrement vidéo optionnel de la remise                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4.3 Anti-Fraud ML Model Features

```python
# Features utilisées par le modèle de scoring anti-fraude

FRAUD_FEATURES = {
    # Comportementaux
    "sender_parcels_last_7d": "Nombre d'envois créés par le sender dans les 7 derniers jours",
    "sender_total_value_last_30d": "Valeur cumulée des envois (EUR) sur 30 jours",
    "sender_avg_parcel_value": "Valeur moyenne par envoi",
    "sender_identical_parcels": "Nombre d'envois avec description/poids identiques",
    "sender_cancelled_rate": "Taux d'annulation du sender",

    # Voyageur
    "traveler_no_show_rate": "Taux de no-show du voyageur",
    "traveler_dispute_rate": "Taux de litiges du voyageur",
    "traveler_new_account_flag": "Compte créé < 7 jours",

    # Interaction
    "chat_messages_count": "Nombre de messages échangés avant acceptation",
    "time_to_accept_hours": "Temps entre notification et acceptation (trop rapide = suspect)",
    "off_platform_contact": "Détection de numéros de téléphone dans le chat (hélas...)",

    # Paiement
    "payment_method_mismatch": "Devise du paiement ≠ devise du voyageur",
    "multiple_cards_same_sender": "Plusieurs cartes utilisées par le même sender",

    # Colis
    "category_risk_score": "Score de risque par catégorie (électronique=0.7, docs=0.1)",
    "value_to_weight_ratio": "Ratio valeur/poids (anomalie si > 500 EUR/kg)",
    "declared_vs_category_value": "Écart entre valeur déclarée et valeur typique de la catégorie",
}

# Output : score entre 0 (sûr) et 1 (fraude probable)
# Seuil d'alerte : > 0.7 → blockage + review manuel
# Seuil de warning : > 0.5 → vérification supplémentaire demandée
```

---

# PARTIE 3 : Ingénierie Financière & Le "Problème du Square" (Fintech)

## 3.1 Le Problème Fondamental : Le Change Algérien

Le dinar algérien (DZD) est **inconvertible** sur le marché international. Le taux officiel (banque d'Algérie) est artificiellement maintenu, tandis que le **marché parallèle** offre le taux réel. Conséquence :

| Indicateur | Valeur (estimation Août 2026) |
|-----------|-------------------------------|
| Taux officiel | 1 EUR ≈ 134 DZD |
| Taux parallèle | 1 EUR ≈ 255-265 DZD |
| Écart | ~90-95% (quasi double) |

Ce différentiel est le **cœur du problème** : si un voyageur algérien accepte d'être payé en DZD au taux officiel via un virement bancaire, il perd ~50% de la valeur réelle. L'app doit naviguer cette réalité sans devenir un outil de change illégal.

## 3.2 Architecture de Paiement Hybride

```mermaid
graph TD
    subgraph "SCÉNARIO A : Sender paie en EUR, Traveler veut EUR (cash Paris)"
        S1[Sender : carte CB française<br/>Stripe PaymentIntent] --> E1[Escrow EUR<br/>LemonWay Wallet]
        E1 -->|"Colis livré ✅"| T1[Traveler : retrait cash EUR<br/>Point de retrait Paris<br/>ou virement SEPA]
    end

    subgraph "SCÉNARIO B : Sender paie en EUR, Traveler veut DZD (compte Algérie)"
        S2[Sender : carte CB française<br/>Stripe PaymentIntent] --> E2[Escrow EUR<br/>LemonWay Wallet]
        E2 -->|"Colis livré ✅"| C[Conversion interne<br/>au taux CrowdShipping<br/>1 EUR = 230 DZD<br/>pas le taux officiel, pas le taux noir<br/>taux "juste" intermédiaire]
        C --> T2[Traveler : DZD via BaridiMob<br/>ou virement CCP<br/>ou cash via agent]
    end

    subgraph "SCÉNARIO C : Paiement en DZD domestique (COD)"
        S3[Sender : DZD via BaridiMob<br/>ou cash via agent] --> E3[Escrow DZD<br/>Wallet BaridiMob]
        E3 -->|"Colis livré ✅"| T3[Traveler : DZD<br/>via BaridiMob ou cash]
    end
```

## 3.3 Flux d'Argent Escrow — Étape par Étape

### Scénario A : EUR → EUR (cash Paris)

```
1. SENDER PAIE
   ├─ Karim (Paris) entre sa carte CB (Visa/Mastercard française)
   ├─ Stripe crée un PaymentIntent : montant = tarif voyageur + assurance + fee
   ├─ 3D Secure activé (obligatoire PSD2)
   ├─ Paiement validé → fonds sur le compte Stripe Connect de CrowdShipping
   └─ Événement : escrow.status = FUNDED

2. ESCROW BLOQUÉ
   ├─ Appel LemonWay API : création d'un wallet "séquestre" lié au colis
   ├─ Fonds transférés de Stripe → LemonWay wallet
   ├─ Statut : escrow.status = LOCKED
   ├─ Aucun retrait possible tant que parcel.status ≠ DELIVERED
   └─ Si annulation avant pickup → remboursement automatique au sender

3. COLIS LIVRÉ
   ├─ Traveler valide la remise via OTP/PIN
   ├─ parcel.status = DELIVERED
   └─ Déclencheur : escrow.status → RELEASED

4. DÉBLOCAGE
   ├─ LemonWay API : release funds du wallet séquestre
   ├─ Calcul automatique :
   │   ├─ Fee plateforme (10%) : déduite
   │   ├─ Assurance (si active) : déduite
   │   └─ Net au traveler : montant - fee - assurance
   ├─ Traveler peut choisir :
   │   ├─ Retrait cash EUR : via un point de retrait partenaire à Paris
   │   │   (ex: Bureau de Poste, Western Agent, bureau CrowdShipping)
   │   ├─ Virement SEPA : vers le compte bancaire du traveler
   │   │   (J+1 ou J+2 selon banque)
   │   └- Conservation dans le wallet LemonWay pour futurs envois
   └─ Événement : escrow.status = RELEASED
```

### Scénario B : EUR → DZD (compte Algérie)

```
1. SENDER PAIE (même que Scénario A)
   ├─ Karim paie 30 EUR par CB → Stripe → Escrow LemonWay
   └─ escrow.status = LOCKED

2. COLIS LIVRÉ
   ├─ OTP validé → parcel.status = DELIVERED
   └─ Déclencheur : conversion EUR → DZD

3. CONVERSION INTERNE
   ├─ Taux CrowdShipping affiché au Traveler lors de l'acceptation :
   │   "1 EUR = 230 DZD" (taux personnalisé, mis à jour quotidiennement)
   │   ├─ Ce taux est un compromis entre officiel (134) et parallèle (260)
   │   ├─ Il est financièrement viable car CrowdShipping opère un spread
   │   └─ **CRITICAL COMPLIANCE NOTE** : Ce spread N'EST PAS une opération
   │       de change. C'est une commission de service perçue par CrowdShipping
   │       pour la prestation de livraison. La facturation affiche :
   │       "Service de livraison : 30 EUR" (facturé au sender)
   │       "Rémunération livraison : 6,900 DZD" (versé au traveler)
   │       Le spread est absorbé dans la fee plateforme augmentée (15% au lieu de 10%)
   │       pour les conversions cross-devises.
   │
   ├─ Conversion exécutée côté LemonWay (wallet multi-devises)
   ├─ 30 EUR → 6,900 DZD (30 × 230)
   ├─ Fee plateforme (15% cross-devise) : 1,035 DZD
   ├─ Net au traveler : 5,865 DZD
   │
   └─ REMISE AU VOYAGEUR
       ├─ Option 1 : BaridiMob (Algérie Post mobile money)
       │   ├─ API BaridiMob : transfert vers compte CCP du traveler
       │   ├─ Délai : quasi instantané (si le réseau fonctionne)
       │   └─ Coût API : ~50 DZD par transaction
       ├─ Option 2 : Virement CCP (Centre Postal Algérien)
       │   ├─ Fichier d'ordre de virement envoyé à Algérie Post
       │   ├─ Délai : 24-48h
       │   └─ Coût : ~200 DZD par virement (déduit du net)
       └─ Option 3 : Cash via Agent CrowdShipping
           ├─ Le traveler se présente à un point relais agréé
           ├─ L'agent vérifie l'OTP de retrait
           ├─ L'agent remet le cash en DZD
           └─ L'agent est remboursé par CrowdShipping en EUR (via LemonWay)
```

### Scénario C : Domestique DZD → DZD (Cash-on-Delivery)

```
1. SENDER CRÉE L'ENVOI EN DZD
   ├─ Amina (Tizi Ouzou) déclare un prix de 2,000 DZD
   ├─ Mode de paiement : COD (Cash on Delivery)
   ├─ Amina dépose 2,000 DZD en cash à un agent CrowdShipping
   │   (ou via BaridiMob / CCP virement)
   ├─ Agent confirme réception → escrow.status = LOCKED
   └─ L'argent est physiquement conservé par l'agent (ou en wallet BaridiMob)

2. COLIS LIVRÉ + PAIEMENT CASH PAR DESTINATAIRE
   ├─ Le traveler livre le colis au destinataire
   ├─ Le destinataire paie 2,000 DZD en cash au traveler
   ├─ Le traveler saisit "Cash reçu : 2,000 DZD" dans l'app + photo des billets
   └─ OTP validé → parcel.status = DELIVERED

3. RÉCONCILIATION CASH
   ├─ Le traveler doit remettre les 2,000 DZD à un agent CrowdShipping
   │   sous 48h (sinon alerte + pénalité sur score de confiance)
   ├─ Agent vérifie OTP de remise → escrow.status = RELEASED
   ├─ Fee plateforme (10%) : 200 DZD déduite
   └─ 1,800 DZD crédités au wallet du traveler (ou cash)

4. SI LE DESTINATAIRE NE PAIE PAS
   ├─ Problème : le traveler est là avec le colis, le destinataire n'a pas l'argent
   ├─ Protocol : traveler coche "Destinataire absent / pas de paiement"
   ├─ Système propose : a) Reporter la livraison, b) Ramener le colis
   ├─ Si ramené : annulation, remboursement du sender
   └─ Si reporté : relance automatique au destinataire + timer 24h
```

## 3.4 Modèle Économique & Revenue

| Source de Revenue | Montant | Description |
|-------------------|---------|-------------|
| **Commission plateforme** | 10% du tarif voyageur | Sur chaque livraison réussie |
| **Commission cross-devise** | 15% (au lieu de 10%) | Spread absorbé pour EUR→DZD |
| **Assurance** | 3% de la valeur déclarée | Payé par le sender, reversé à l'assureur |
| **Prime (visa express)** | 2 EUR par envoi | Matching prioritaire + badge boosté |
| **Frais d'annulation tardive** | 5 EUR | Si annulation < 24h avant le trajet |
| **Publicité (futur)** | N/A | Bannières in-app pour les commerçants partenaires |

**Unit Economics (MVP)** :

```
Transaction type : Paris → Alger, colis moyen (3 kg, 25 EUR tarif)
├─ Commission (10%) : 2.50 EUR
├─ Revenue net par transaction : 2.50 EUR
│
Transaction type : Paris → Alger, colis moyen, conversion EUR→DZD
├─ Commission cross-devise (15%) : 3.75 EUR
├─ Revenue net par transaction : 3.75 EUR
│
Cible : 1,000 transactions/mois à 6 mois
├─ Revenue mensuel estimé : 2,500 - 3,750 EUR
├─ Burn rate mensuel (équipe 5 personnes) : ~15,000 EUR
├─ Runway nécessaire : 18 mois = 270,000 EUR minimum seed
```

---

# PARTIE 4 : Matrice Légale, Douanière et Conformité (Le Mur)

## 4.1 Réglementation Douanière Algérienne — Règles Intégrées dans l'App

### 4.1.1 La "Franchise Voyageur" (Articles 68-73 du Code des Douanes)

La franchise voyageur en Algérie permet à tout voyageur d'importer, pour ses besoins personnels, des effets et objets neufs dans les limites suivantes :

| Catégorie | Franchise | Détails |
|----------|-----------|---------|
| **Effets personnels** | Exempté | Vêtements, articles de toilette, bijoux personnels (quantité raisonnable) |
| **Appareils électroniques** | **1 appareil par type** | Ex: 1 téléphone, 1 ordinateur portable, 1 tablette (pas de stock) |
| **Cosmétiques & parfums** | 5 produits max | Quantités "personnelles" (pas de revente) |
| **Médicaments** | 3 mois de traitement | **Obligatoirement** avec ordonnance traduite |
| **Alimentation** | 5 kg max | Produits du terroir, non périssables |
| **Cadeaux** | Valeur totale < 10,000 DZD | (~40 EUR au taux officiel, ~17 EUR au taux parallèle) |
| **Total voyageur** | Valeur totale < 30,000 DZD | (~120 EUR officiel, ~58 EUR parallèle) — seuil à ne **pas** dépasser sans déclaration |

### 4.1.2 Produits Interdits (Liste Noire — Bloquage Programmatique)

```
BLOCAGE AUTOMATIQUE PAR L'APP (catégorie douanière) :

❌ Drones (tous types, y compris jouets)
❌ Armes et munitions (même airsoft)
❌ Stupéfiants et substances psychotropes
❌ Publications "contraires à la morale islamique" (interprétation large)
❌ Alcool (sauf allowance officielle très limitée, non applicable via l'app)
❌ Produits israéliens (loi algérienne de boycott)
❌ Matériel de communication non homologué (walkie-talkies non agréés)
❌ Satellite phones et GPS hors-ligne de haute précision
❌ Jeux de hasard et loteries
❌ Contrefaçons (automatiquement détecté par AI image classification)
❌ Animaux vivants (sans certificat vétérinaire — à bloquer sauf cas spécial)

⚠️ WARNING (déclaration requise, pas de blocage) :
⚠️ Appareils électroniques de valeur > 300 EUR (déclaration spéciale)
⚠️ Quantités de médicaments > 3 mois de traitement
⚠️ Matériel professionnel (outils, équipements)
⚠️ Cosmétiques en grande quantité (> 5 produits)
⚠️ Pièces automobile
```

### 4.1.3 Mécanisme de Blocage Programmatique

```python
# Customs Compliance Engine — intégré dans Parcel Service

PROHIBITED_CATEGORIES = {
    "drones": {"block": True, "message": "Les drones sont interdits à l'importation en Algérie (Arrêté ministériel 2015)."},
    "weapons": {"block": True, "message": "Les armes et munitions sont strictement interdites."},
    "alcohol": {"block": True, "message": "L'alcool ne peut pas être transporté via CrowdShipping."},
    "narcotics": {"block": True, "message": "Les stupéfiants sont strictement interdits. Signalement automatique."},
    "counterfeit": {"block": True, "message": "Les contrefaçons sont interdites par le droit algérien et international."},
}

DECLARATION_REQUIRED = {
    "electronics": {
        "threshold_value_eur": 300,
        "max_quantity": 1,  # Per device type
        "message": "Les appareils électroniques > 300 EUR nécessitent une déclaration douanière spéciale."
    },
    "medicine": {
        "max_months_treatment": 3,
        "requires_prescription": True,
        "message": "Les médicaments nécessitent une ordonnance (max 3 mois de traitement)."
    },
    "cosmetics": {
        "max_items": 5,
        "message": "Maximum 5 produits cosmétiques sous franchise voyageur."
    },
    "electronics_multiple": {
        "max_total_electronics": 2,  # Max 2 electronic devices total
        "message": "Maximum 2 appareils électroniques par voyageur sous franchise."
    }
}

def validate_parcel_customs(parcel: Parcel) -> CustomsValidationResult:
    """
    Valide un colis contre les règles douanières algériennes.
    Appelé à la création du colis ET au matching.
    """
    errors = []
    warnings = []

    # 1. Check prohibited categories
    for category, rule in PROHIBITED_CATEGORIES.items():
        if parcel.category.lower() == category or category in parcel.subCategory.lower():
            errors.append(rule["message"])
            # ALERT : log pour investigation anti-fraude
            log_security_event(
                event_type="PROHIBITED_ITEM_ATTEMPT",
                user_id=parcel.senderId,
                parcel_id=parcel.id,
                category=category
            )

    # 2. Check declaration-required categories
    if parcel.category in DECLARATION_REQUIRED:
        rule = DECLARATION_REQUIRED[parcel.category]

        if "threshold_value_eur" in rule:
            if parcel.estimatedValue > rule["threshold_value_eur"]:
                warnings.append(rule["message"])
                parcel.requiresDeclaration = True

        if "max_quantity" in rule:
            # Check if traveler already has similar items
            existing = count_parcels_by_category_for_traveler(parcel.matchedTripId, parcel.category)
            if existing >= rule["max_quantity"]:
                errors.append(f"Limite atteinte : {rule['max_quantity']} {parcel.category} par voyageur.")

        if "requires_prescription" in rule and rule["requires_prescription"]:
            if not parcel.prescriptionUrl:
                errors.append("Une ordonnance médicale est obligatoire pour les médicaments.")
                parcel.requiresDeclaration = True

    # 3. Check total franchise value
    if parcel.estimatedValue > 120:  # ~30,000 DZD au taux officiel
        warnings.append(
            f"La valeur déclarée ({parcel.estimatedValue} EUR) dépasse la franchise voyageur. "
            f"Des droits de douane peuvent s'appliquer (jusqu'à 30% de la valeur). "
            f"Le voyageur devra déclarer ces biens."
        )
        parcel.requiresDeclaration = True

    # 4. AI Image Classification (async)
    for photo_url in parcel.photoUrls:
        result = classify_image(photo_url)
        if result.category in PROHIBITED_CATEGORIES:
            errors.append(f"AI a détecté un produit potentiellement interdit : {result.category}")
            if result.confidence > 0.85:
                # High confidence — auto-block
                parcel.status = "BLOCKED_CUSTOMS"
                return CustomsValidationResult(errors=errors, warnings=warnings, blocked=True)

    return CustomsValidationResult(errors=errors, warnings=warnings, blocked=len(errors) > 0)
```

## 4.2 Clauses de Responsabilité (ToS — Termes de Service)

### 4.2.1 Responsabilité en Cas de Saisie Douanière

```
EXTRAIT DES CGU — CLAUSE DE SAISIE DOUANIÈRE (Rédaction préliminaire — à valider par avocat)

────────────────────────────────────────────────────────────
ARTICLE 14 : RESPONSABILITÉ EN CAS DE SAISIE DOUANIÈRE
────────────────────────────────────────────────────────────

14.1 PRINCIPE GÉNÉRAL
En cas de saisie du colis par les autorités douanières algériennes
(Aéroport Houari Boumédiène, Port d'Alger, ou tout point d'entrée),
la responsabilité est répartie comme suit :

14.1.1 CAS 1 : LE COLIS RESPECTAIT LES RÈGLES DE FRANCHISE VOYAGEUR
Si le colis a été déclaré conformément aux règles de la franchise voyageur
(CrowdShipping a validé la conformité via son moteur de conformité)
ET que le voyageur a présenté les bordereaux générés par l'application :

  → L'assurance CrowdShipping couvre 100% de la valeur déclarée.
  → Le Sender est remboursé intégralement via l'Escrow.
  → Le Traveler n'est pas tenu responsable.

14.1.2 CAS 2 : LE SENDER A FOURNI DES FAUSSES INFORMATIONS
Si le colis contient des articles non déclarés ou des informations
inexactes (poids, valeur, nature des articles) par rapport à la déclaration :

  → L'assurance ne couvre PAS la saisie.
  → L'Escrow est remboursé au Sender (moins les frais de dossier : 10 EUR).
  → Le Sender est responsable vis-à-vis du Traveler pour le
    temps perdu et les éventuelles amendes douanières.
  → Le compte du Sender est suspendu pour enquête.

14.1.3 CAS 3 : LE VOYAGEUR N'A PAS DÉCLARÉ LE COLIS
Si le voyageur a omis de déclarer le colis à la douane alors que
les bordereaux étaient disponibles dans l'application :

  → Le voyageur est tenu responsable de la saisie.
  → Le Sender est remboursé intégralement via l'assurance.
  → CrowdShipping se retourne contre le voyageur pour récupérer
    les frais (déduction du wallet, poursuite si nécessaire).
  → Le compte du voyageur est suspendu.

14.2 PROCÉDURE EN CAS DE SAISIE
a) Le voyageur informe immédiatement via l'application (bouton "Saisie douanière")
b) Le voyageur télécharge le procès-verbal de saisie (photo) dans l'app
c) CrowdShipping ouvre un ticket de dispute dans les 2h
d) L'assurance est notifiée sous 24h
e) Le Sender est notifié et informé des options :
   - Remboursement via assurance (si éligible)
   - Contestation de la saisie (CrowdShipping fournit un modèle de lettre)
f) Délai de résolution : 14 jours ouvrés maximum
────────────────────────────────────────────────────────────
```

## 4.3 Gestion des Litiges — Protocole de Remise

### 4.3.1 Processus de Validation de Livraison

```
┌──────────────────────────────────────────────────────────────────┐
│              PROTOCOLE DE REMISE EN MAIN PROPRE                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ÉTAPE 1 : ARRIVÉE DU VOYAGEUR                                  │
│  ├─ Le traveler arrive à l'adresse de livraison                  │
│  ├─ Live location activée automatiquement (si < 5 km)           │
│  └─ Notification au destinataire + sender                         │
│                                                                  │
│  ÉTAPE 2 : VALIDATION D'IDENTITÉ                                │
│  ├─ Le destinataire fournit :                                   │
│  │   ├─ OPTION A : OTP à 6 chiffres (envoyé par l'app au sender│
│  │   │   qui le transmet au destinataire)                        │
│  │   ├─ OPTION B : QR code (scanné par le traveler)              │
│  │   ├─ OPTION C : Nom + dernier 4 chiffres du téléphone        │
│  │   └─ OPTION D : Pièce d'identité (si colis de haute valeur)  │
│  └─ Le traveler saisit le code dans l'app                        │
│                                                                  │
│  ÉTAPE 3 : INSPECTION DU COLIS (optionnel mais recommandé)       │
│  ├─ Le destinataire peut ouvrir le colis devant le traveler      │
│  ├─ Vérification : état, contenu, conformité                     │
│  ├─ Si conforme → le destinataire coche "Accepté" dans l'app    │
│  ├─ Si non conforme → le destinataire coche "Litige"            │
│  │   └─ Déclenche immédiatement le processus de dispute         │
│  └─ Temps maximum pour accepter/rejeter : 30 minutes            │
│                                                                  │
│  ÉTAPE 4 : PREUVE DE REMISE                                      │
│  ├─ Photo obligatoire : le traveler prend une photo du colis     │
│  │   remis (avec accord du destinataire)                         │
│  ├─ Photo horodatée + géotaggée automatiquement                  │
│  ├─ QR code de remise : généré par l'app, signé cryptographiquement│
│  │   (contient : parcelId, travelerId, timestamp, location)     │
│  └─ Empreinte digitale du destinataire (si l'app est installée) │
│                                                                  │
│  ÉTAPE 5 : DÉBLOCAGE ESCROW                                     │
│  ├─ Si toutes les conditions sont remplies :                     │
│  │   ├─ OTP/PIN correct ✅                                       │
│  │   ├─ Photo prise ✅                                           │
│  │   ├─ Pas de litige déclaré ✅                                 │
│  │   └─ Timeout non dépassé ✅                                   │
│  ├─ → Escrow débloqué AUTOMATIQUEMENT                            │
│  ├─ → Paiement versé au traveler                                 │
│  ├─ → Notification : "Livraison confirmée ! Paiement envoyé."    │
│  └─ → Si litige : Escrow maintenu bloqué → médiation (Partie 4.4)│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3.2 QR Code de Remise (Format)

```json
{
  "version": "CS-QR-001",
  "type": "PARCEL_DELIVERY",
  "parcelId": "550e8400-e29b-41d4-a716-446655440000",
  "travelerId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "senderId": "1f8e6679-7425-40de-944b-e07fc1f90ae8",
  "timestamp": "2026-08-06T14:30:00+01:00",
  "location": {
    "lat": 36.7538,
    "lng": 3.0588,
    "accuracy": 15,
    "address": "Bab El Oued, Alger"
  },
  "signature": "HMAC-SHA256:a3f2b7c8d9e1f0... (32 bytes hex)"
}
```

---

# PARTIE 5 : Go-To-Market, Growth Hacking & Saisonnalité

## 5.1 Stratégie "L'Œuf et la Poule" — Acquérir les 1,000 Premiers Travelers

### 5.1.1 Le Problème de la Marketplace Bilatérale

CrowdShipping ne fonctionne que s'il y a **simultanément** des Travelers (offre de transport) et des Senders (demande d'envoi). Comment amorcer ?

### 5.1.2 Phase 1 : Acquérir les Travelers (Mois 1-3)

| Stratégie | Canal | Cible | KPI | Budget |
|----------|-------|-------|-----|--------|
| **Recrutement communautaire** | Groupes Facebook diaspora ("BlaBlaCar Algérie", "Voyage Marseille-Alger") | Voyageurs réguliers | 100 inscrits/mois | 0 EUR (gratuit) |
| **Programme "Travelers Founders"** | Landing page dédiée + formulaire Google Form | Voyageurs réguliers (5+ trajets/an) | 50 VIP inscrits | 500 EUR (adhésions offertes + goodies) |
| **Partenariat agences de voyage** | Agences spécialisées Algérie (Paris 10e, 18e, Marseille) | Clients avec billets achetés | 30 inscrits/mois | Commission 5% par referral |
| **Ambassadeurs campus** | Étudiants algériens à Paris, Lyon, Marseille, Toulouse | Retour au pays pendant vacances | 200 inscrits/saison estivale | 1,000 EUR (goodies + events) |
| **Presence aux ports/aéroports** | Flyers + QR codes (légal si sur terrain public) | Voyageurs en attente d'embarquement | 50 inscrits/événement | 300 EUR/printing |
| **SEO "transport colis Algerie"** | Blog + landing pages optimisées | Recherche intent : "envoyer colis Algerie pas cher" | 500 visits/mois | 200 EUR (content) |

### 5.1.3 Phase 2 : Générer la Demande (Mois 2-4)

Une fois 200+ Travelers actifs sur la plateforme :

| Stratégie | Canal | Cible | KPI |
|----------|-------|-------|-----|
| **Offre lancement** : 1er envoi gratuit (fee plateforme = 0%) | Push aux Senders potentiels | Diaspora France | 500 premiers envois |
| **Témoignages vidéo** | TikTok + Instagram Reels | 18-35 ans diaspora | 50K vues/campagne |
| **Partenariats épiceries algériennes** | Épiceries "produits du terroir" en France | Expatriés qui veulent des produits locaux | 100 referrals/mois |
| **Referral program** : "Invite un ami, envoi à -50%" | In-app + WhatsApp | Viralité organique | 30% growth rate |

## 5.2 Marketing Communautaire — Plan d'Action

### 5.2.1 Groupes Facebook Ciblés

| Nom du groupe (type) | Taille estimée | Stratégie |
|----------------------|----------------|-----------|
| "BlaBlaCar Algérie France" | 50K+ membres | Posts sponsorisés + témoignages |
| "Diaspora Algérienne France" | 200K+ membres | Post naturel (story) + AMA |
| "Étudiants algériens en France" | 30K+ membres | Offre étudiante (-20%) |
| "Voyage Marseille Alger Ferry" | 10K+ membres | Focus voyageurs ferry |
| "Chibani France" (aînés de la diaspora) | 20K+ membres | Messages simples, assistance téléphonique |
| "Achats en ligne Algérie" | 15K+ membres | Positionnement "alternative aux transitaire" |

### 5.2.2 TikTok / Instagram Strategy

```
CONTENTS PILIERS (3x/semaine) :

POST TYPE 1 : TÉMOIGNAGES (40%)
├─ "Comment Fatima a envoyé un colis à sa mère à Oran pour 15 EUR"
├─ Format : Interview face caméra + captures d'écran de l'app
├─ Durée : 45-90 secondes
└─ CTA : "Link in bio — 1er envoi offert"

POST TYPE 2 : ÉDUCATIF (30%)
├─ "Les 5 erreurs à éviter quand on envoie un colis en Algérie"
├─ "Franchise voyageur : ce que vous avez le droit d'envoyer"
├─ "Comment être payé en EUR quand vous voyagez vers Alger"
├─ Format : Carousel Instagram + vidéo TikTok
├─ Durée : 60 secondes
└─ CTA : "Abonnez-vous pour plus d'astuces"

POST TYPE 3 : SOCIAL PROOF (30%)
├─ "Regardez comment Ahmed a gagné 150 EUR en rentabilisant son trajet"
├─ Screenshot du dashboard gains du traveler (anonymisé)
├─ Format : Before/After + compte à rebours
└─ CTA : "Deviens Traveler → lien bio"
```

## 5.3 Gestion des Pics Saisonniers

### 5.3.1 Calendrier des Saisons Fortes en Algérie

| Période | Événement | Impact | Plan Opérationnel |
|---------|-----------|--------|-------------------|
| **Juin - Septembre** | Saison estivale + traversées maritimes (boost) | +300% de trafic ferry, +150% de demandes | Scaling serveurs, recrutement agents temporaires, campagne marketing agressive |
| **Ramadan (variable)** | Envois de cadeaux, dattes, vêtements | +200% de demandes (hautement saisonnier) | Pré-positionnement de Travelers, offres "Ramadan Express" |
| **Septembre - Octobre** | Rentrée universitaire (retour étudiants) | +250% de voyages étudiants | Campagne campus, tarif étudiant, packages "retour" |
| **Décembre - Janvier** | Fêtes de fin d'année | +100% de cadeaux | Packaging cadeaux, assurance offerte |
| **Mars - Avril** | Printemps (retour vacanciers) | +80% | Campagne "Ramène du terroir" |

### 5.3.2 Plan Opérationnel — Saison Estivale (Juin-Septembre)

```
T-30 JOURS (Mai) :
├─ Scaling infrastructure : server auto-scaling configuré
│   ├─ Kubernetes HPA : min 3 pods → max 15 pods par service
│   ├─ Redis cluster : bascule en mode cluster (6 nodes)
│   └─ CDN Cache : augmentation TTL à 24h pour les assets statiques
├─ Recrutement agents :
│   ├─ 5 agents supplémentaires à Alger (points relais)
│   ├─ 2 agents à Oran, 1 à Constantine
│   └─ Formation sur le process de haute saison
├─ Marketing pré-saison :
│   ├─ Campagnes Facebook Ads (budget : 3,000 EUR)
│   ├─ Emails aux Senders inactifs depuis > 30 jours
│   └─ Notifications push : "La saison des traversées approche !"
│
T-7 JOURS (Fin Mai) :
├─ Stress test de l'infrastructure (simulation 10K req/sec)
├─ Vérification des partenariats avec les compagnies ferry (SNCM, CNAN)
├─ Pool de Travelers vérifiés : minimum 500 actifs
├─ Support client : équipe élargie (8h → 16h couverture, 7j/7)
│
SAISON ACTIVE (Juin-Septembre) :
├─ Dashboard temps réel : nombre de trajets, colis en transit, litiges
├─ Alertes automatiques si SLA dépassé (> 2h pour matching)
├─ Reporting quotidien au team operations
├─ Flex pricing : les tarifs voyageurs augmentent de 15% pendant les pics
│
POST-SAISON (Octobre) :
├─ Analyse des métriques de la saison
├─ Retention campaigns pour les Travelers acquis
├─ Net Promoter Score survey aux Senders
└─ Préparation de la saison Ramadan (si applicable)
```

---

# PARTIE 6 : Analyse des Risques (Pre-Mortem)

## 6.1 Les 5 Raisons de Faillite Potentielles dans les 18 Premiers Mois

### 🔴 RISQUE #1 : Saisies Douanières en Cascade (Fatalité 30%)

**Scénario** : Les douanes algériennes durcissent les contrôles (contexte politique, pression sur les importations). 20% des colis sont saisis pendant un mois. Les Senders paniquent, les Travelers refusent de transporter, l'assurance ne couvre pas le volume.

**Impact** : Destruction de la confiance. Churn massif. News négatives sur les réseaux sociaux.

**Plan de Contingence** :

| Action | Responsable | Timeline |
|--------|------------|----------|
| A. Souscrire une assurance dédiée "risque douanier Algérie" (si un assureur accepte le risque) | CEO + Legal | Mois 1-2 |
| B. Implémenter un système de "scoring douanier" par point d'entrée (aéroport vs ferry vs route) | CTO | Mois 3 |
| C. Afficher clairement les risques douaniers AVANT chaque envoi (transparence totale) | Product | Mois 1 |
| D. Partenariat avec un transitaire agréé à Alger pour les colis à risque (fallback professionnel) | BD | Mois 4-6 |
| E. Limiter les catégories à haut risque (électronique > 500 EUR) en phase MVP | Product | Mois 1 |

### 🔴 RISQUE #2 : Adoption Lente du Côté Voyageurs (Fatalité 25%)

**Scénario** : Les voyageurs n'ont pas envie de s'embêter avec des colis pour gagner 15-30 EUR. La friction est trop élevée (KYC, rendez-vous, responsabilité). Le marché du "cabas informel" continue en dehors de l'app.

**Plan de Contingence** :

| Action | Responsable | Timeline |
|--------|------------|----------|
| A. UX ultra-simplifiée pour le voyageur ("2 taps pour accepter un colis") | Product + Design | Mois 1-2 |
| B. Garantie minimum de 25 EUR par trajet (subventionnée par CrowdShipping au début) | Finance | Mois 1-3 |
| C. Programme d'ambassadeurs : top 50 travelers = statut VIP + bonus | Growth | Mois 2 |
| D. Partenariat avec les compagnies aériennes/ferry : integration dans leur app (white label) | BD + CTO | Mois 6-9 |
| E. Si adoption < 100 travelers actifs à mois 3 : pivot vers modèle "agence de voyage" avec coursiers dédiés | CEO | Mois 3 (decision gate) |

### 🔴 RISQUE #3 : Risque Réglementaire / Légal (Fatalité 20%)

**Scénario** : Le gouvernement algérien interdit les plateformes de crowd-shipping, ou impose une licence impossible à obtenir. L'app est bloquée au niveau DNS (comme cela a été fait pour d'autres apps). Ou la Banque d'Algérie bloque les flux de paiement.

**Plan de Contingence** :

| Action | Responsable | Timeline |
|--------|------------|----------|
| A. Enregistrement d'une entité juridique en Algérie (SARL avec capital 100K DZD) | CEO + Legal | Mois 1 |
| B. Consultation avec un avocat spécialisé en droit commercial algérien | Legal | Mois 1 |
| C. Relation proactive avec la Chambre de Commerce Algérie (services aux diasporas) | CEO | Mois 2-3 |
| D. Conformité AML/KYC renforcée (montrer que l'app n'est PAS un outil de change) | Compliance | Mois 1-2 |
| E. Plan de repli : limiter les opérations aux trajets internationaux (pas domestique) si le marché local est bloqué | CEO | Mois 6 (decision gate) |
| F. Architecture multi-juridiction : siège en France (EU) + filiale Algérie | CEO + Legal | Mois 1-2 |

### 🔴 RISQUE #4 : Problème de Paiement / Compliance Fintech (Fatalité 15%)

**Scénario** : Stripe ou LemonWay suspend le compte CrowdShipping pour activité "high risk" (liée à l'Algérie, réputation marché parallèle). Les fonds sont gelés. Les utilisateurs ne peuvent plus être payés.

**Plan de Contingence** :

| Action | Responsable | Timeline |
|--------|------------|----------|
| A. Diversification des PSP : Stripe + LemonWay + MangoPay + Wise (multi-vitrine) | CTO + Finance | Mois 1-3 |
| B. Transparence totale avec les PSP : sharing économique complet, KYC renforcé | Compliance | Mois 1 |
| C. Modèle de paiement "hors app" en fallback : travellers sont payés directement par les senders en cash, CrowdShipping prend sa commission via un abonnement/membership | Product + Finance | Mois 4 (si besoin) |
| D. Réserve de liquidité : 50K EUR en réserve pour 30 jours de remboursements | Finance | Mois 1 |
| E. Audit externe AML/KYC (Big 4) pour crédibiliser le modèle | Compliance | Mois 6 |

### 🔴 RISQUE #5 : Conflit avec le Marché Informel / Réseau de "Cabassiers" (Fatalité 10%)

**Scénario** : Le réseau informel des "cabassiers" (personnes qui font du transport de colis informel depuis des décennies) se sent menacé. Campagnes de dénigrement, pression sur les voyageurs pour ne pas utiliser l'app, voire menaces physiques dans certains cas.

**Plan de Contingence** :

| Action | Responsable | Timeline |
|--------|------------|----------|
| A. Ne PAS se positionner comme "destructeur" du cabas, mais comme "modernisation" | Marketing | Mois 1 |
| B. Recruter certains cabassiers comme Travelers premium (ils sont les meilleurs) | Growth | Mois 2-3 |
| C. Communication : "l'application protège aussi le voyageur" (assurance, traçabilité) | Marketing | Continu |
| D. Si menaces : signalement aux autorités (consulats, ambassades) | CEO + Legal | Immédiat |
| E. Fonctionnalité anonymat partiel pour les travelers (pseudo affiché, pas le vrai nom) | Product | Mois 3 |

---

## 6.2 Matrice des Risques (Vue Synthétique)

| # | Risque | Probabilité | Impact | Score (P×I) | Plan B Activé si |
|---|-------|------------|--------|-------------|-----------------|
| 1 | Saisies douanières en cascade | Moyenne (40%) | Critique | **16/25** | > 15% de saisies sur 30 jours |
| 2 | Adoption lente voyageurs | Moyenne (50%) | Critique | **20/25** | < 100 travelers actifs à M3 |
| 3 | Risque réglementaire Algérie | Faible-Moyenne (30%) | Critique | **15/25** | Aucune indication officielle, mais veille continue |
| 4 | Suspension compte PSP | Faible (20%) | Critique | **12/25** | Si un PSP suspend le compte |
| 5 | Conflit réseau informel | Faible (15%) | Élevé | **9/25** | Si campagnes de dénigrement coordonnées |

---

# ANNEXES

## Annexe A : Glossaire Algérie-Spécifique

| Terme | Définition |
|-------|-----------|
| **Cabas** | Marché informel de transport de colis entre la diaspora et l'Algérie |
| **Cabassier** | Personne qui pratique le transport informel de colis |
| **Wilaya** | Division administrative algérienne (équivalent département), 58 wilayas |
| **Commune** | Subdivision de wilaya, 1,541 communes |
| **CCP** | Centre Postal de Chèques Postaux (compte postal algérien) |
| **BaridiMob** | Application mobile d'Algérie Post pour paiements/transferts |
| **Franchise voyageur** | Droit d'importer des effets personnels sans droits de douane |
| **DZD** | Dinar algérien (monnaie non convertible) |
| **Chibani** | Personne âgée de la diaspora (terme affectueux, littéralement "barbe grise") |
| **Ksar/Ksour** | Village fortifié au Sahara |
| **Zone blanche** | Zone sans couverture réseau mobile |

## Annexe B : API Tierces — Contact & Pricing

| Service | Usage | Pricing (estimé) | Contact |
|---------|-------|-----------------|---------|
| Sumsub | KYC/AML | 1.50 EUR/verification | enterprise@sumsub.com |
| Mapbox | Geocoding + Maps | 5 USD/1000 geocoding calls | mapbox.com |
| Stripe | EUR payments | 1.4% + 0.25 EUR (EU cards) | stripe.com |
| LemonWay | Escrow wallets | 0.50 EUR/transaction + setup | lemonway.fr |
| Twilio | SMS international | 0.05-0.10 EUR/SMS | twilio.com |
| Firebase | Push notifications | Gratuit (jusqu'à 1M) | firebase.google.com |
| Sentry | Error tracking | 26 USD/mois (Team) | sentry.io |
| Datadog | Monitoring | 23 USD/host/mois | datadoghq.com |

## Annexe C : Timeline de Développement (18 mois)

| Phase | Mois | Livrables | Équipe |
|-------|------|-----------|--------|
| **Phase 0 : Validation** | M1-M2 | Landing page, 100 pré-inscriptions, entités juridiques | CEO + 1 dev |
| **Phase 1 : MVP** | M3-M6 | App mobile (iOS+Android), backend core, KYC, Escrow EUR, 5 wilayas pilotes | 2 devs + 1 designer + 1 PM |
| **Phase 2 : Launch** | M7-M9 | Lancement public France→Alger, 500 users, itérations UX | Équipe complète (7 personnes) |
| **Phase 3 : Scale** | M10-M12 | Expansion domestique (10 wilayas), paiement DZD, assurance | + 2 devs + 1 ops |
| **Phase 4 : Growth** | M13-M18 | Expansion Europe (Canada, Espagne, Belgique), 10K users, B2B pilotes | + 2 devs + 2 growth marketers |

---

> **Document généré le 6 août 2026. Version 1.0. Prochain update : après validation des parties prenantes.**
>
> *Ce document est CONFIDENTIEL et destiné exclusivement aux fondateurs, investisseurs et membres de l'équipe de développement de CrowdShipping.*
