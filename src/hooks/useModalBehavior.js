import { useEffect, useRef } from 'react';

/**
 * Custom hook to enforce rock-solid modal behavior across all POS dialogs:
 * - Locks background body scrolling while open
 * - Listens for 'Escape' key to close dismissible modals
 * - Restores focus to the element that triggered the modal
 * - Prevents accidental backdrop dismissal on destructive dialogs
 */
export function useModalBehavior({ isOpen, onClose, isDestructive = false }) {
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Capture element that had focus before opening modal
    previousActiveElementRef.current = document.activeElement;

    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Return focus to trigger element
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        try {
          previousActiveElementRef.current.focus();
        } catch {
          // Ignore focus errors
        }
      }
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    // Only dismiss if the click happened directly on the backdrop (not bubbling from inside)
    if (e.target === e.currentTarget && !isDestructive) {
      onClose?.();
    }
  };

  return { handleBackdropClick };
}

