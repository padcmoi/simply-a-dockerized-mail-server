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
} satisfies Locales["apiErrors"];
