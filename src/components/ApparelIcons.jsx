import React from 'react';

// Clean, consistent, professional menswear SVG icons (24x24 viewBox)
export function ShirtIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Collared classic dress shirt */}
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.5a2 2 0 001.98 1.67H6v10a1 1 0 001 1h10a1 1 0 001-1V10.86h1.16a2 2 0 001.98-1.67l.58-3.5a2 2 0 00-1.34-2.23z" />
      <path d="M10 2l2 4 2-4" />
      <path d="M12 6v14" />
      <circle cx="12" cy="9" r="0.5" fill="currentColor" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      <circle cx="12" cy="15" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function PantIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Tailored trousers / pants */}
      <path d="M5 2h14v3l-1.5 16h-4L12 9.5 10.5 21H6.5L5 5V2z" />
      <path d="M5 5h14" />
      <path d="M12 2v3" />
      <path d="M9 2v3" />
      <path d="M15 2v3" />
    </svg>
  );
}

export function TShirtIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Casual crewneck t-shirt */}
      <path d="M6 3h12l3 4-2.5 3L17 8.5V21H7V8.5L5.5 10 3 7l3-4z" />
      <path d="M9 3a3 3 0 006 0" />
    </svg>
  );
}

export function HalfSleeveShirtIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Half sleeve collared shirt */}
      <path d="M7 3h10l3.5 3-2 3.5L16.5 8V21h-9V8L5.5 9.5 3.5 6 7 3z" />
      <path d="M10 3l2 3.5 2-3.5" />
      <path d="M12 6.5V21" />
      <circle cx="12" cy="10" r="0.5" fill="currentColor" />
      <circle cx="12" cy="14" r="0.5" fill="currentColor" />
    </svg>
  );
}

export function FullSleeveShirtIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Formal full sleeve shirt with cuffs */}
      <path d="M8 2.5h8l5 6-1.5 9.5-3-1 1-6.5L16 9v12H8V9l-1.5 1.5 1 6.5-3 1L3 8.5l5-6z" />
      <path d="M10 2.5l2 3.5 2-3.5" />
      <path d="M12 6V21" />
      <line x1="18.5" y1="17" x2="21.5" y2="18" />
      <line x1="2.5" y1="18" x2="5.5" y2="17" />
    </svg>
  );
}

export function ShortsIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Menswear casual shorts */}
      <path d="M5 4h14v2.5l-1 9h-4.5L12 11l-1.5 4.5H6l-1-9V4z" />
      <path d="M5 6.5h14" />
      <path d="M12 4v2.5" />
      <line x1="6" y1="13" x2="10" y2="13" />
      <line x1="14" y1="13" x2="18" y2="13" />
    </svg>
  );
}

export function JeansIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Denim jeans with belt loops and rivets */}
      <path d="M5 2h14v3l-1.5 16h-4L12 9.5 10.5 21H6.5L5 5V2z" />
      <path d="M5 5h14" />
      <path d="M12 2v3" />
      <circle cx="8" cy="7" r="0.5" fill="currentColor" />
      <circle cx="16" cy="7" r="0.5" fill="currentColor" />
      <path d="M7 9a2 2 0 002-2" />
      <path d="M17 9a2 2 0 01-2-2" />
    </svg>
  );
}

export function TracksIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Athletic track pants with side stripes */}
      <path d="M5 3h14v2.5l-1.5 16h-4L12 9.5 10.5 21.5H6.5L5 5.5V3z" />
      <path d="M7 6v14" strokeDasharray="1 1" />
      <path d="M17 6v14" strokeDasharray="1 1" />
      <path d="M10 3a2 2 0 004 0" />
    </svg>
  );
}

export function JerseyTShirtIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Sports jersey t-shirt */}
      <path d="M6 3h12l3 4-2.5 3L17 8.5V21H7V8.5L5.5 10 3 7l3-4z" />
      <path d="M9 3a3 3 0 006 0" />
      <path d="M12 11v4" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function CustomApparelIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Clothes hanger with apparel tag */}
      <path d="M12 3a2.5 2.5 0 012.5 2.5c0 .9-.5 1.7-1.3 2.1L12 8.5v1.5" />
      <path d="M12 10L2 16h20L12 10z" />
      <circle cx="12" cy="18" r="3" />
      <path d="M12 17v2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function HoodieIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Premium hooded sweatshirt with hood and kangaroo pouch */}
      <path d="M7 6.5C7 3.5 9 2 12 2s5 1.5 5 4.5" />
      <path d="M5.5 8L3 11l2.5 7.5L8 18v3h8v-3l2.5.5L21 11l-2.5-3-3.5 1.5c-.8-.6-1.8-1-3-1s-2.2.4-3 1L5.5 8z" />
      <path d="M9 16h6a1 1 0 011 1v2H8v-2a1 1 0 011-1z" />
      <path d="M10.5 7.5v3" />
      <path d="M13.5 7.5v3" />
    </svg>
  );
}

export const APPAREL_ICON_MAP = {
  Shirt: ShirtIcon,
  Pant: PantIcon,
  Jeans: JeansIcon,
  TShirt: TShirtIcon,
  HalfSleeve: HalfSleeveShirtIcon,
  FullSleeve: FullSleeveShirtIcon,
  Tracks: TracksIcon,
  Shorts: ShortsIcon,
  JerseyTShirt: JerseyTShirtIcon,
  Hoodie: HoodieIcon,
  CustomItem: CustomApparelIcon,
};
