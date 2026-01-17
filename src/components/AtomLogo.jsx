import React from 'react';

export default function AtomLogo({ className = "h-10 w-10", ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Atom nucleus (center circle) */}
      <circle cx="50" cy="50" r="6" fill="currentColor" />
      
      {/* Electron orbits (3 elliptical paths) */}
      {/* Orbit 1 - Horizontal */}
      <ellipse
        cx="50"
        cy="50"
        rx="32"
        ry="18"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
      />
      {/* Electron on orbit 1 */}
      <circle cx="82" cy="50" r="3.5" fill="currentColor" />
      
      {/* Orbit 2 - Rotated 60 degrees */}
      <ellipse
        cx="50"
        cy="50"
        rx="32"
        ry="18"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
        transform="rotate(60 50 50)"
      />
      {/* Electron on orbit 2 - positioned at right side of rotated ellipse */}
      <circle cx="66" cy="34" r="3.5" fill="currentColor" />
      
      {/* Orbit 3 - Rotated 120 degrees */}
      <ellipse
        cx="50"
        cy="50"
        rx="32"
        ry="18"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
        transform="rotate(120 50 50)"
      />
      {/* Electron on orbit 3 - positioned at right side of rotated ellipse */}
      <circle cx="34" cy="66" r="3.5" fill="currentColor" />
    </svg>
  );
}
