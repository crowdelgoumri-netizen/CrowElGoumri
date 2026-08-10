/**
 * Corridor & currency config — the realization of "all Europe → Algeria".
 *
 * This is the ONLY place in the mobile app where origin countries, cities,
 * and currencies live. Everything else reads from here. Adding a new
 * origin country is a data change to this file, never a code change.
 *
 * Why all EUR countries together (Tier 1): the backend's escrow path is
 * EUR-agnostic at the data layer (it stores whatever currency the parcel
 * declares) and the customs/prohibited-items surface is destination-driven
 * (Algeria), not origin-driven. So every EUR-using European country is
 * instantly supported with zero backend work. Non-EUR countries (PL, SE,
 * DK, UK…) are Tier 2 — they need the multi-currency subsystem and live in
 * a separate file when that ships.
 *
 * Source: blueprint §1.1 (diaspora = France/Canada/Espagne + résidants),
 * §1.2 edge-cases (Paris→Alger, Marseille→Alger, Lyon→Oran corridors).
 */
export interface OriginCountry {
  code: string; // ISO-3166 alpha-2
  name: string;
  currency: "EUR"; // Tier 1 = EUR only; Tier 2 widens this union
  cities: readonly string[];
}

export const ORIGIN_COUNTRIES = [
  {
    code: "FR",
    name: "France",
    currency: "EUR",
    cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Lille", "Bordeaux", "Nantes", "Strasbourg"],
  },
  {
    code: "DE",
    name: "Allemagne",
    currency: "EUR",
    cities: ["Berlin", "Hamburg", "München", "Frankfurt", "Köln", "Stuttgart"],
  },
  {
    code: "ES",
    name: "Espagne",
    currency: "EUR",
    cities: ["Madrid", "Barcelona", "Valencia", "Alicante", "Málaga", "Sevilla"],
  },
  {
    code: "IT",
    name: "Italie",
    currency: "EUR",
    cities: ["Roma", "Milano", "Napoli", "Torino", "Firenze", "Bologna"],
  },
  {
    code: "BE",
    name: "Belgique",
    currency: "EUR",
    cities: ["Bruxelles", "Anvers", "Liège", "Gand", "Charleroi"],
  },
  {
    code: "NL",
    name: "Pays-Bas",
    currency: "EUR",
    cities: ["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven"],
  },
  {
    code: "PT",
    name: "Portugal",
    currency: "EUR",
    cities: ["Lisboa", "Porto", "Braga", "Coimbra", "Faro"],
  },
  {
    code: "IE",
    name: "Irlande",
    currency: "EUR",
    cities: ["Dublin", "Cork", "Galway", "Limerick"],
  },
  {
    code: "AT",
    name: "Autriche",
    currency: "EUR",
    cities: ["Wien", "Graz", "Linz", "Salzburg", "Innsbruck"],
  },
  {
    code: "GR",
    name: "Grèce",
    currency: "EUR",
    cities: ["Athina", "Thessaloniki", "Patra", "Heraklion"],
  },
  {
    code: "FI",
    name: "Finlande",
    currency: "EUR",
    cities: ["Helsinki", "Tampere", "Turku", "Oulu"],
  },
  {
    code: "LU",
    name: "Luxembourg",
    currency: "EUR",
    cities: ["Luxembourg", "Esch-sur-Alzette", "Differdange"],
  },
] as const satisfies readonly OriginCountry[];

/**
 * Destination — fixed to Algeria for v1. The 58 wilayas power the address
 * picker's destination selector. Adding a second destination (Tunisia,
 * Morocco) is the genuinely heavy work — new customs rules, new prohibited
 * lists — and is explicitly out of scope.
 */
export const WILAYAS_1_58 = [
  "Adrar", "Chlef", "Laghouat", "Oum El Bouaghi", "Batna", "Béjaïa", "Biskra",
  "Béchar", "Blida", "Bouira", "Tamanrasset", "Tébessa", "Tlemcen", "Tiaret",
  "Tizi Ouzou", "Alger", "Djelfa", "Jijel", "Sétif", "Saïda", "Skikda",
  "Sidi Bel Abbès", "Annaba", "Guelma", "Constantine", "Médéa", "Mostaganem",
  "M'Sila", "Mascara", "Ouargla", "Oran", "El Bayadh", "Illizi",
  "Bordj Bou Arréridj", "Boumerdès", "El Tarf", "Tindouf", "Tissemsilt",
  "El Oued", "Khenchela", "Souk Ahras", "Tipaza", "Mila", "Aïn Defla",
  "Naâma", "Aïn Témouchent", "Ghardaïa", "Relizane",
  // New wilayas (2019 administrative expansion):
  "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès",
  "In Salah", "In Guezzam", "Touggourt", "Djanet", "El M'Ghair",
  "El Meniaa",
] as const;

export const DESTINATION = {
  code: "DZ",
  name: "Algérie",
  wilayas: WILAYAS_1_58,
} as const;

/**
 * Convenience: flat list of "Paris → Alger"-style corridors for quick-pick
 * UIs. Built from the config, not hand-maintained.
 */
export const POPULAR_CORRIDORS: readonly string[] = [
  "Paris → Alger",
  "Lyon → Oran",
  "Marseille → Alger",
  "Paris → Constantine",
  "Bruxelles → Tizi Ouzou",
  "Madrid → Oran",
];
