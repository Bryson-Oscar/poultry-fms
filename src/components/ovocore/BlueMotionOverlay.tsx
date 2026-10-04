import React from 'react';

/**
 * Renders a highly dynamic, ambient blue motion overlay behind the main application UI.
 * This component is visually non-blocking (pointer-events-none).
 * Make sure to wrap your main layout or container with relative positioning if you want it contained.
 */
export function BlueMotionOverlay() {
  return (
    <div className="blue-motion-overlay">
      <div className="motion-glow-core"></div>
      <div className="motion-glow-drift"></div>
    </div>
  );
}
