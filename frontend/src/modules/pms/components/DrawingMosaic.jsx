import React from 'react';
import DrawingPreviewThumb from './DrawingPreviewThumb';

/**
 * Album-style mosaic of drawing thumbnails.
 *
 *   1 → full box
 *   2 → side-by-side split
 *   3 → 1 big left + 2 stacked right
 *   4 → 2×2 grid
 *   5+ → 2×2 grid, last tile shows "+N" overlay (N = drawings.length - 4)
 *
 * Each tile clicks through to PreviewDrawingModal for that drawing.
 *
 * Props:
 *   drawings  — array (required)
 *   size      — square edge in px (default 200)
 */
const DrawingMosaic = ({ drawings = [], size = 200 }) => {
  if (!drawings.length) return null;

  const visible = drawings.slice(0, 4);
  const count   = visible.length;
  const extra   = Math.max(0, drawings.length - 4);

  const containerStyle = { width: size, height: size };

  // Pick layout
  let gridClass;
  if (count === 1)      gridClass = 'grid grid-cols-1 grid-rows-1';
  else if (count === 2) gridClass = 'grid grid-cols-2 grid-rows-1';
  else if (count === 3) gridClass = 'grid grid-cols-2 grid-rows-2';
  else                  gridClass = 'grid grid-cols-2 grid-rows-2';

  return (
    <div
      className={`${gridClass} gap-1 rounded-xl overflow-hidden`}
      style={containerStyle}
    >
      {visible.map((d, i) => {
        // 3-tile layout: first tile spans both rows on the left
        const isFirstOfThree = count === 3 && i === 0;
        const isLastWithExtra = extra > 0 && i === count - 1;

        return (
          <DrawingPreviewThumb
            key={d._id}
            drawing={d}
            compact
            className={`w-full h-full rounded-none ${isFirstOfThree ? 'row-span-2' : ''}`}
            overlay={isLastWithExtra ? <PlusMoreOverlay count={extra} /> : null}
          />
        );
      })}
    </div>
  );
};

const PlusMoreOverlay = ({ count }) => (
  <div
    className="absolute inset-0 bg-black/55 flex items-center justify-center
               text-white font-extrabold text-2xl select-none pointer-events-none"
  >
    +{count}
  </div>
);

export default DrawingMosaic;
