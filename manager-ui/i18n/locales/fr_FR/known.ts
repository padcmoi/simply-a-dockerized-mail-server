import type { Locales } from "../../Locales";

export default {
  networksTitle: "Mes réseaux connus",
  networksCardHint: "Les opérateurs d'où vous vous connectez sans preuve supplémentaire",
  networksAlertTitle: "Les opérateurs d'où vous vous connectez.",
  networksAlertDescription:
    "Un réseau, c'est un pays et un numéro d'AS, celui de l'opérateur qui détient l'adresse ; dessous, les adresses d'où une session s'est ouverte. Chaque opérateur et chaque adresse sont retenus un temps après leur dernière connexion. Revenir d'une adresse retenue ne demande rien. Une adresse inconnue est mesurée contre l'adresse retenue la plus proche : trop loin, elle demande une preuve de plus que le mot de passe, comme un opérateur absent de cette liste, quelle que soit la distance, ou un retour après que toutes les adresses ou tous les opérateurs ont expiré. Oublier un opérateur efface aussi ses adresses.",
  networksEmpty: "Aucun réseau connu",
  networksEmptyHint: "Le premier opérateur et la première adresse sont retenus à la prochaine connexion, sans rien demander.",
  networksFooter:
    "La ville affichée est celle que le fournisseur de géolocalisation associe à l'adresse, à titre indicatif. Ce qui décide, c'est la distance au lieu retenu et l'opérateur.",
  networkKeptUntil: "retenu jusqu'au {date}",
  addressKeptUntil: "retenue jusqu'au {date}",
  addressesNone: "Aucune adresse retenue pour cet opérateur",
  seenCount: "{count} connexions",
  lastSeen: "vu",
  forgetNetwork: "Oublier ce réseau",
  networkForgotten: "Réseau oublié",
  forgetFailed: "Échec de l'oubli",
  loadFailed: "Échec du chargement",
} satisfies Locales["known"];
