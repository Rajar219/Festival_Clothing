// FESTIVAL CLOTHING POS - Terminal Device Identity Service
// Distinguishes Main PC Cash Counter vs Mobile Floor Terminal
const TERMINAL_ID_KEY = 'wisdo_terminal_id_v2';
const TERMINAL_TYPE_KEY = 'wisdo_terminal_type_v2';

/**
 * Generates a stable random terminal ID if not already stored
 */
export function getTerminalId() {
  if (typeof window === 'undefined') return 'server_terminal';
  try {
    let id = localStorage.getItem(TERMINAL_ID_KEY);
    if (!id) {
      const type = getTerminalType();
      const rand = Math.random().toString(36).substring(2, 9);
      id = `term_${type.toLowerCase()}_${Date.now().toString(36)}_${rand}`;
      localStorage.setItem(TERMINAL_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'fallback_terminal';
  }
}

/**
 * Returns 'PC' or 'MOBILE'
 */
export function getTerminalType() {
  if (typeof window === 'undefined') return 'PC';
  try {
    const stored = localStorage.getItem(TERMINAL_TYPE_KEY);
    if (stored === 'PC' || stored === 'MOBILE') {
      return stored;
    }
    // Auto-detect based on touchscreen / user-agent / screen width
    const isMobileDevice =
      window.innerWidth <= 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const detected = isMobileDevice ? 'MOBILE' : 'PC';
    localStorage.setItem(TERMINAL_TYPE_KEY, detected);
    return detected;
  } catch (e) {
    return 'PC';
  }
}

/**
 * Manually override terminal designation (e.g., from Admin Settings)
 * @param {'PC' | 'MOBILE'} type
 */
export function setTerminalType(type) {
  if (typeof window === 'undefined') return;
  const valid = type === 'MOBILE' ? 'MOBILE' : 'PC';
  try {
    localStorage.setItem(TERMINAL_TYPE_KEY, valid);
    // Regenerate ID to match type
    const rand = Math.random().toString(36).substring(2, 9);
    const newId = `term_${valid.toLowerCase()}_${Date.now().toString(36)}_${rand}`;
    localStorage.setItem(TERMINAL_ID_KEY, newId);
  } catch (e) {
    console.warn('Failed to save terminal designation:', e);
  }
}

/**
 * Returns full terminal summary metadata
 */
export function getTerminalInfo() {
  const type = getTerminalType();
  const id = getTerminalId();
  return {
    terminalId: id,
    terminalType: type,
    name: type === 'PC' ? 'Main PC Cash Counter' : 'Mobile Handheld Terminal',
    isMobile: type === 'MOBILE',
    isPC: type === 'PC',
  };
}

