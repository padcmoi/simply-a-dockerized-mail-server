// Shared open/collapsed state for the app sidebar. Both the sidebar itself
// (AppNavigation) and the top header toggle (AppHeader) drive it, so it lives in
// a shared useState rather than being prop-drilled through the layout.
export function useSidebar() {
  const open = useState("sidebar-open", () => true);
  function toggle() {
    open.value = !open.value;
  }
  function close() {
    open.value = false;
  }
  return { open, toggle, close };
}
