import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Rectangle } from "./window-placement.js";

export type RendererSource =
  | { kind: "file"; rendererFile: string }
  | { kind: "development"; origin: string };

export const resolveRendererSource = (
  configuredUrl: string | undefined,
  rendererFile: string,
): RendererSource => {
  if (!configuredUrl?.trim()) {
    return { kind: "file", rendererFile: resolve(rendererFile) };
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error("PARALLEL_RENDERER_URL must be a localhost HTTP origin");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    parsed.protocol !== "http:" ||
    !loopbackHosts.has(parsed.hostname) ||
    parsed.port.length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.pathname !== "/" ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error("PARALLEL_RENDERER_URL must be a localhost HTTP origin");
  }
  return { kind: "development", origin: parsed.origin };
};

export const isTrustedRendererDocumentUrl = (
  candidate: string,
  source: RendererSource,
): boolean => {
  try {
    const parsed = new URL(candidate);
    if (parsed.hash.length > 0) return false;
    const queryKeys = [...parsed.searchParams.keys()];
    if (
      queryKeys.length !== 1 ||
      queryKeys[0] !== "view" ||
      !["capture", "sidecar", "mapping"].includes(
        parsed.searchParams.get("view") ?? "",
      )
    ) {
      return false;
    }
    if (source.kind === "development") {
      return parsed.origin === source.origin && parsed.pathname === "/";
    }
    return (
      parsed.protocol === "file:" &&
      resolve(fileURLToPath(parsed)) === source.rendererFile
    );
  } catch {
    return false;
  }
};

export const assertTrustedIpcSender = (
  sender: { senderId: number; senderUrl: string },
  expectedSenderId: number,
  source: RendererSource,
): void => {
  if (
    sender.senderId !== expectedSenderId ||
    !isTrustedRendererDocumentUrl(sender.senderUrl, source)
  ) {
    throw new Error("Rejected untrusted IPC sender");
  }
};

export const validateNoPayload = (args: readonly unknown[]): void => {
  if (args.length !== 0) {
    throw new Error("Unexpected IPC payload");
  }
};

export const validateSinglePayload = (args: readonly unknown[]): unknown => {
  if (args.length !== 1) {
    throw new Error("Expected exactly one IPC payload");
  }
  return args[0];
};

const MAX_CROP_BYTES = 8 * 1_024 * 1_024;
const MAX_CROP_DATA_URL_LENGTH =
  Math.ceil((MAX_CROP_BYTES * 4) / 3) + 64;
const DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean => {
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    [...expectedKeys].sort().every((key, index) => key === actualKeys[index])
  );
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const validateCropPayload = (
  payload: unknown,
  displayBounds: Rectangle,
): { cropDataUrl: string; bounds: Rectangle } => {
  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, ["cropDataUrl", "bounds"]) ||
    typeof payload.cropDataUrl !== "string" ||
    !isRecord(payload.bounds) ||
    !hasExactKeys(payload.bounds, ["x", "y", "width", "height"])
  ) {
    throw new Error("Invalid crop payload");
  }
  if (payload.cropDataUrl.length > MAX_CROP_DATA_URL_LENGTH) {
    throw new Error("Invalid crop image bytes");
  }
  const match = DATA_URL_PATTERN.exec(payload.cropDataUrl);
  const encoded = match?.[1];
  if (
    !encoded ||
    encoded.length % 4 !== 0 ||
    encoded.length > Math.ceil((MAX_CROP_BYTES * 4) / 3) + 4
  ) {
    throw new Error("Invalid crop image data URL");
  }
  const decoded = Buffer.from(encoded, "base64");
  if (
    decoded.byteLength === 0 ||
    decoded.byteLength > MAX_CROP_BYTES ||
    decoded.toString("base64").replace(/=+$/u, "") !==
      encoded.replace(/=+$/u, "")
  ) {
    throw new Error("Invalid crop image bytes");
  }

  const { x, y, width, height } = payload.bounds;
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    width < 24 ||
    height < 24 ||
    width > displayBounds.width ||
    height > displayBounds.height ||
    x < displayBounds.x ||
    y < displayBounds.y ||
    x + width > displayBounds.x + displayBounds.width ||
    y + height > displayBounds.y + displayBounds.height
  ) {
    throw new Error("Invalid crop bounds");
  }

  return {
    cropDataUrl: payload.cropDataUrl,
    bounds: { x, y, width, height },
  };
};

const ANCHOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

export const validateAnchorIds = (
  value: unknown,
  allowedAnchorIds: readonly string[],
): string[] => {
  if (
    !Array.isArray(value) ||
    value.length > 64 ||
    value.some(
      (item) => typeof item !== "string" || !ANCHOR_PATTERN.test(item),
    )
  ) {
    throw new Error("Invalid mapping anchor payload");
  }
  const unique = new Set(value);
  const allowed = new Set(allowedAnchorIds);
  if (
    unique.size !== value.length ||
    value.some((anchorId) => !allowed.has(anchorId))
  ) {
    throw new Error("Unknown mapping anchor");
  }
  return [...value];
};

export type RendererOutcome =
  | "unlocked"
  | "wrong_twin"
  | "another_twin"
  | "not_same";

const RENDERER_OUTCOMES = new Set<RendererOutcome>([
  "unlocked",
  "wrong_twin",
  "another_twin",
  "not_same",
]);

export const validateOutcome = (value: unknown): RendererOutcome => {
  if (
    typeof value !== "string" ||
    !RENDERER_OUTCOMES.has(value as RendererOutcome)
  ) {
    throw new Error("Unsupported outcome payload");
  }
  return value as RendererOutcome;
};
