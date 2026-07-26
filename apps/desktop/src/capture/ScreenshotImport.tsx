import { useEffect, useRef, useState } from "react";
import {
  fitImportedCrop,
  readImportedFile,
  validateImportedFile,
  type ImageSize,
  type ImportRectangle,
} from "./import-image.js";

interface SelectedScreenshot {
  dataUrl: string;
  name: string;
  size: ImageSize | null;
}

interface ScreenshotImportProps {
  displayBounds: ImportRectangle;
  onSubmit(cropDataUrl: string, bounds: ImportRectangle): void;
  onDismiss(): void;
  onOpenScreenSettings(): void;
}

export function ScreenshotImport({
  displayBounds,
  onSubmit,
  onDismiss,
  onOpenScreenSettings,
}: ScreenshotImportProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const importSequence = useRef(0);
  const [selected, setSelected] = useState<SelectedScreenshot | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  const importFiles = async (files: readonly File[]): Promise<void> => {
    const sequence = ++importSequence.current;
    setError("");
    setReading(true);
    try {
      const file = validateImportedFile(files);
      const dataUrl = await readImportedFile(file);
      if (sequence !== importSequence.current) return;
      setSelected({ dataUrl, name: file.name || "Pasted screenshot", size: null });
    } catch (reason) {
      if (sequence !== importSequence.current) return;
      setSelected(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "PARALLEL could not read that screenshot.",
      );
    } finally {
      if (sequence === importSequence.current) setReading(false);
    }
  };

  return (
    <main
      className="import-shell"
      aria-label="Screenshot import"
      onPaste={(event) => {
        event.preventDefault();
        void importFiles(Array.from(event.clipboardData.files));
      }}
    >
      <header className="import-header">
        <div>
          <span className="brand">PARALLEL</span>
          <h1>Bring one problem</h1>
        </div>
        <button type="button" className="quiet-button" onClick={onDismiss}>
          Close
        </button>
      </header>

      <p className="import-intro">
        Paste, drop, or choose a screenshot containing one complete 2D Statics
        problem and its diagram.
      </p>

      <button
        type="button"
        data-testid="screenshot-drop-zone"
        className={`import-drop-zone${dragging ? " is-dragging" : ""}${
          selected ? " has-preview" : ""
        }`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void importFiles(Array.from(event.dataTransfer.files));
        }}
      >
        {selected ? (
          <img
            src={selected.dataUrl}
            alt="Selected problem screenshot"
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } =
                event.currentTarget;
              if (width > 0 && height > 0) {
                setSelected((current) =>
                  current ? { ...current, size: { width, height } } : current,
                );
              } else {
                setError("PARALLEL could not decode that screenshot.");
              }
            }}
            onError={() => {
              setSelected(null);
              setError("PARALLEL could not decode that screenshot.");
            }}
          />
        ) : (
          <>
            <span className="import-icon" aria-hidden="true">
              ↙
            </span>
            <strong>{reading ? "Reading…" : "Drop screenshot here"}</strong>
            <span>or click to choose · ⌘V to paste</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose screenshot"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void importFiles(files);
        }}
      />

      {selected ? (
        <div className="import-selection">
          <span title={selected.name}>{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setError("");
            }}
          >
            Replace
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="import-error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="privacy-note">
        PARALLEL never saves this screenshot. It stays in the in-memory
        session, is sent only to your configured AI provider to make the twin,
        and is discarded when you close.
      </p>

      <button
        type="button"
        className="primary import-submit"
        disabled={!selected?.size || reading}
        onClick={() => {
          if (!selected?.size) return;
          onSubmit(
            selected.dataUrl,
            fitImportedCrop(selected.size, displayBounds),
          );
        }}
      >
        Make twin
      </button>

      <aside className="permission-note">
        <p>
          Screen Recording is optional. It only enables one-click lasso.
        </p>
        <button type="button" onClick={onOpenScreenSettings}>
          Enable one-click lasso
        </button>
      </aside>
    </main>
  );
}
