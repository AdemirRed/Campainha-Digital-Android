import { useEffect } from 'react';

export function usePreventNavigation() {
  useEffect(() => {
    // Prevent back button navigation
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    // Push initial state
    window.history.pushState(null, '', window.location.href);

    // Listen for popstate
    window.addEventListener('popstate', handlePopState);

    // Prevent context menu (long press)
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}
