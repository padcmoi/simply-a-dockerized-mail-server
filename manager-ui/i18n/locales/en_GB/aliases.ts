import type { Locales } from "../../Locales";

export default {
  alertTitle: "Forward an address (or a whole domain) to one or more real recipients.",
  backToList: "Back to aliases",
  form: {
    title: "Add an alias",
    domain: "Domain",
    domainPlaceholder: "Pick a domain",
    localPart: "Local part",
    localPartInvalid: "Letters, digits and . _ + - only, no domain",
    destination: "Destination",
    destinationPlaceholder: "real.example.com",
    destinationInvalid: "Must be a valid email address",
    submit: "Add",
  },
  table: {
    from: "From",
    to: "To",
    domain: "Domain",
  },
  toast: {
    pickDomain: "Pick a domain first",
    created: "Alias created",
    createFailed: "Create failed",
  },
  editPage: {
    button: "Edit",
    title: "Edit {source}",
    saved: "Alias updated",
    saveFailed: "Update failed",
    loadFailed: "Could not load this alias",
  },
} satisfies Locales["aliases"];
