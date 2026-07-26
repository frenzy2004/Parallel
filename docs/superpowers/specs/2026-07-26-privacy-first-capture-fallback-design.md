# Privacy-First Capture Fallback Design

## Goal

Make Screen Recording optional. `Option+Space` keeps the instant full-screen
lasso when permission is granted; otherwise PARALLEL opens a calm, compact
import view where a learner can paste, drop, or choose one screenshot of one
complete problem.

## Product behavior

- Granted screen access: preserve the existing full-screen capture and lasso.
- Any other screen-access status: open a compact import window instead of a
  blocking warning dialog.
- The import view accepts exactly one PNG, JPEG, or WebP image by paste,
  drag/drop, or native file picker.
- It previews the selected image, explains that the image remains in memory,
  and submits it through the existing bounded crop IPC and generation path.
- Its copy says: “Screen Recording is optional. It only enables one-click
  lasso.”
- “Enable one-click lasso” invokes a main-owned, sender-validated IPC action
  that opens the exact macOS Screen Recording System Settings pane.
- Escape and Close dismiss the private session.

## Architecture and trust boundaries

The existing renderer document gains an `import` view. A dedicated
`ScreenshotImport` component owns paste/drop/file-picker UX and creates a data
URL only from a browser `File`; no path or file handle crosses into main.

Main creates a fixed-size, framed import `BrowserWindow` on the display nearest
the cursor and records that display as the crop boundary. Submission reuses
`parallel:submit-crop`; renderer sends the imported image with the visible
preview element’s real screen rectangle. After successful submission, that
window becomes a locked **Original screenshot** reference so mapping
highlights have a truthful target. Main applies the existing exact-key, MIME,
base64, byte-limit, finite-number, and display-containment validation before
starting generation.

The System Settings capability is a separate no-payload IPC method. Main
accepts it only from the active import window whose `webContents` identity and
document URL both match the configured trusted renderer. External navigation,
window creation, SVG, multiple files, oversized images, invalid data URLs, and
unexpected IPC arguments fail closed.

Imported image bytes remain in the renderer only while the visible reference
is open. The generation lease releases its raw input at recognition (and every
terminal path), and regeneration uses only the canonical signature and
allowlisted evidence. No new persistence or logging is added; dismissal closes
the reference and invalidates the abstract generation lease.

## Error handling

Unsupported, multiple, empty, or unreadable files produce an inline actionable
message without closing the import window. A failed submission preserves the
preview so the learner can retry. Main-process validation errors continue
through the existing handled failure path.

## Testing

- Pure import validation tests cover allowed formats, single-file enforcement,
  empty/oversized rejection, and exact preview-to-screen geometry.
- Component tests exercise choose, paste, drop, preview, submit, invalid input,
  locked reference, close, and System Settings behavior against real DOM
  events.
- Runtime-guard tests prove `import` is a trusted view but lookalike URLs remain
  untrusted.
- Generation-session and engine tests prove private input can be released
  without invalidating generation, stale leases cannot clear newer input, and
  abstract regeneration starts without screenshot bytes.
- Full workspace tests, typecheck, production build, privacy verifier, and
  native runtime probe remain required.
