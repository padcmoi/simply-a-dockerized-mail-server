import type { Locales } from "../../Locales";

export default {
  networksTitle: "My known networks",
  networksCardHint: "The operators you sign in from without an extra proof",
  networksAlertTitle: "The operators you sign in from.",
  networksAlertDescription:
    "A network is a country and an autonomous system number, the operator holding the address; under it, the addresses a session has opened from. Every operator and every address is kept for a while after its last sign-in. Coming back from a known address asks for nothing. An unknown address is measured against the nearest known address: too far, it has to hand over one proof more than the password, as does an operator absent from this list, whatever the distance, or a return once all the addresses or all the operators have expired. Forgetting an operator forgets its addresses too.",
  networksEmpty: "No known network",
  networksEmptyHint: "The first operator and the first address are remembered at the next sign-in, without asking anything.",
  networksFooter:
    "The city shown is the one the geolocation provider ties to the address, for information. What decides is the distance to the known place and the operator.",
  networkKeptUntil: "kept until {date}",
  addressKeptUntil: "kept until {date}",
  addressesNone: "No address kept for this operator",
  seenCount: "{count} sign-ins",
  lastSeen: "seen",
  forgetNetwork: "Forget this network",
  networkForgotten: "Network forgotten",
  forgetFailed: "Failed to forget",
  loadFailed: "Failed to load",
} satisfies Locales["known"];
