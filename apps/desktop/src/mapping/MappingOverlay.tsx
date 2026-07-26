import type { JSX } from "react";

export interface MappingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export function MappingOverlay({
  rectangles,
}: {
  rectangles: MappingRect[];
}): JSX.Element {
  return (
    <main className="mapping-overlay" aria-hidden="true">
      {rectangles.map((rectangle) => (
        <div
          key={`${rectangle.label}-${rectangle.x}-${rectangle.y}`}
          className="mapping-rect"
          style={{
            left: rectangle.x,
            top: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
          }}
        >
          <span>{rectangle.label}</span>
        </div>
      ))}
    </main>
  );
}
