import { useEffect, useRef } from 'react';

export function useInactivityTimer(callback: () => void, delay: number) {
  const timeoutRef = useRef<number>();

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(callback, delay);
    };

    // Events that indicate user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    // Start timer on mount
    resetTimer();

    // Reset timer on user activity
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [callback, delay]);
}
