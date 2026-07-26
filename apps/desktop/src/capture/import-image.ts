const ALLOWED_RASTER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_IMPORT_BYTES = 8 * 1_024 * 1_024;

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImportRectangle extends ImageSize {
  x: number;
  y: number;
}

export const validateImportedFile = (files: readonly File[]): File => {
  if (files.length !== 1) {
    throw new Error("Choose or paste one screenshot.");
  }
  const [file] = files;
  if (!file || !ALLOWED_RASTER_TYPES.has(file.type)) {
    throw new Error("Use a PNG, JPEG, or WebP screenshot.");
  }
  if (file.size === 0) {
    throw new Error("That screenshot is empty.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error("Keep the screenshot under 8 MiB.");
  }
  return file;
};

export const readImportedFile = async (file: File): Promise<string> => {
  validateImportedFile([file]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("PARALLEL could not read that screenshot."));
    };
    reader.onload = () => {
      const result = reader.result;
      if (
        typeof result !== "string" ||
        !/^data:image\/(?:png|jpeg|webp);base64,/u.test(result)
      ) {
        reject(new Error("PARALLEL could not read that screenshot."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
};

const assertPositiveFiniteSize = (
  size: ImageSize,
  label: string,
): void => {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error(`Invalid ${label} dimensions.`);
  }
};

export const fitImportedCrop = (
  image: ImageSize,
  display: ImportRectangle,
): ImportRectangle => {
  assertPositiveFiniteSize(image, "image");
  assertPositiveFiniteSize(display, "display");
  if (!Number.isFinite(display.x) || !Number.isFinite(display.y)) {
    throw new Error("Invalid display dimensions.");
  }

  const scale = Math.min(
    display.width / image.width,
    display.height / image.height,
  );
  const width = Math.max(24, Math.min(display.width, Math.round(image.width * scale)));
  const height = Math.max(
    24,
    Math.min(display.height, Math.round(image.height * scale)),
  );
  return {
    x: display.x + Math.round((display.width - width) / 2),
    y: display.y + Math.round((display.height - height) / 2),
    width,
    height,
  };
};
