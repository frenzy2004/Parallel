import { useEffect, useMemo, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LassoProps {
  captureDataUrl: string;
  onSubmit(cropDataUrl: string, bounds: Selection): void;
  onDismiss(): void;
}

const rectangleFromPoints = (start: Point, end: Point): Selection => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

export function Lasso({
  captureDataUrl,
  onSubmit,
  onDismiss,
}: LassoProps): JSX.Element {
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const selection = useMemo(
    () => (start && end ? rectangleFromPoints(start, end) : null),
    [start, end],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  const complete = (point: Point): void => {
    if (!start || !imageRef.current) return;
    const box = rectangleFromPoints(start, point);
    if (box.width < 24 || box.height < 24) {
      setStart(null);
      setEnd(null);
      return;
    }
    const image = imageRef.current;
    const scaleX = image.naturalWidth / image.clientWidth;
    const scaleY = image.naturalHeight / image.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width * scaleX);
    canvas.height = Math.round(box.height * scaleY);
    canvas
      .getContext("2d")
      ?.drawImage(
        image,
        box.x * scaleX,
        box.y * scaleY,
        box.width * scaleX,
        box.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    onSubmit(canvas.toDataURL("image/png"), {
      x: window.screenX + box.x,
      y: window.screenY + box.y,
      width: box.width,
      height: box.height,
    });
  };

  return (
    <main
      className="capture-surface"
      onPointerDown={(event) => {
        const point = { x: event.clientX, y: event.clientY };
        setStart(point);
        setEnd(point);
      }}
      onPointerMove={(event) => {
        if (start) setEnd({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) =>
        complete({ x: event.clientX, y: event.clientY })
      }
    >
      <img
        ref={imageRef}
        className="capture-image"
        src={captureDataUrl}
        alt=""
        draggable={false}
      />
      <div className="capture-shade" />
      {selection ? (
        <div
          className="lasso-box"
          style={{
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
          }}
        />
      ) : null}
      <div className="capture-instruction" role="status">
        Drag around one complete 2D Statics problem · Esc to cancel
      </div>
    </main>
  );
}
