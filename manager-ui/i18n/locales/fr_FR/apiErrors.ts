import type { Locales } from "../../Locales";

export default {
  validation: {
    failed: "Certains champs ont été refusés",
  },
  recipients: {
    // A bare "@" opens a linked message (@:some.key) for vue-i18n's compiler
    // and fails the whole file; `{'@'}` is its literal-interpolation escape.
    postmasterReserved: "postmaster{'@'} est réservé et provisionné automatiquement pour chaque domaine",
    alreadyExists: "{email} existe déjà",
    notFound: "Le destinataire #{id} n'existe plus dans {domain}",
    postmasterImmutable: "La boîte postmaster est gérée automatiquement et ne peut pas être modifiée",
    postmasterUndeletable: "La boîte postmaster est gérée automatiquement et ne peut pas être supprimée",
    quotaBelowUsage: "Le quota ne peut pas descendre sous les {usedMb} Mo déjà occupés par {email}",
    quotaExceedsDomain:
      "Il ne reste que {availableMb} Mo sur {domain} : son quota est de {domainQuotaMb} Mo, dont {allocatedMb} Mo déjà attribués à ses autres destinataires",
  },
  mail: {
    notConfigured: "Le serveur de mail sortant n'est pas configuré, aucun envoi n'est possible",
    otpInvalid: "Code de vérification invalide ou expiré",
    sendFailed: "Échec de l'envoi : {detail}",
  },
  delegations: {
    quotaExceedsDomain: "Impossible d'octroyer {requestedMb} Mo sur {domain} : seuls {grantableMb} Mo restent engageables",
    ownerNotDelegable: "Le propriétaire du domaine gère déjà tout et n'a besoin d'aucune délégation",
    noDelegation: "Vous n'avez aucune délégation sur ce domaine",
    recipientCapReached: "Vous avez atteint votre plafond de boîtes ({max})",
    aliasCapReached: "Vous avez atteint votre plafond d'alias ({max})",
    reserveExceeded: "Cette boîte dépasserait votre quota octroyé ({usedMb} sur {reservedMb} Mo utilisés, {requestedMb} Mo demandés)",
  },
} satisfies Locales["apiErrors"];
