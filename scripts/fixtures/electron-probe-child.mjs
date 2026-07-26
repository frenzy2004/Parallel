const mode = process.argv[2];
const sentinel =
  process.env.PARALLEL_TEST_READY_SENTINEL ?? "missing-test-sentinel";

switch (mode) {
  case "ready":
    process.stdout.write(`${sentinel}\n`);
    setInterval(() => undefined, 1_000);
    break;
  case "lookalike":
    process.stdout.write(`prefix ${sentinel} suffix\n`);
    setInterval(() => undefined, 1_000);
    break;
  case "silent":
    setInterval(() => undefined, 1_000);
    break;
  case "early-zero":
    process.exit(0);
    break;
  case "nonzero":
    process.exit(7);
    break;
  default:
    process.exit(9);
}
