import type { Locales } from "../../Locales";

export default {
  validation: {
    failed: "Some fields were rejected",
  },
  recipients: {
    // A bare "@" opens a linked message (@:some.key) for vue-i18n's compiler
    // and fails the whole file; `{'@'}` is its literal-interpolation escape.
    postmasterReserved: "postmaster{'@'} is reserved and provisioned automatically for every domain",
    alreadyExists: "{email} already exists",
    notFound: "Recipient #{id} no longer exists in {domain}",
    postmasterImmutable: "The postmaster mailbox is managed automatically and cannot be modified",
    postmasterUndeletable: "The postmaster mailbox is managed automatically and cannot be deleted",
    quotaBelowUsage: "The quota cannot go below the {usedMb} MB {email} already stores",
    quotaExceedsDomain:
      "Only {availableMb} MB left on {domain}: its quota is {domainQuotaMb} MB, of which {allocatedMb} MB are already allocated to its other recipients",
  },
  mail: {
    notConfigured: "Outbound mail is not configured, so nothing can be sent",
    otpInvalid: "Invalid or expired verification code",
    sendFailed: "Sending failed: {detail}",
  },
  delegations: {
    quotaExceedsDomain: "Cannot grant {requestedMb} MB on {domain}: only {grantableMb} MB can still be committed",
    ownerNotDelegable: "The domain owner already manages everything and needs no delegation",
    noDelegation: "You have no delegation on this domain",
    recipientCapReached: "You've reached your mailbox cap ({max})",
    aliasCapReached: "You've reached your alias cap ({max})",
    reserveExceeded:
      "That mailbox wouldn't fit your granted quota ({usedMb} of {reservedMb} MB used, {requestedMb} MB requested)",
  },
} satisfies Locales["apiErrors"];
