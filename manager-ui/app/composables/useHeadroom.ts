// Whether the top bar is currently out of the way. AppHeader is what decides
// it, from the scroll; anything else that pins itself under the bar reads it
// here, so a panel header and the bar are never both claiming the same strip of
// the window.
export function useHeadroom() {
  return useState("layout-headroom-hidden", () => false);
}
