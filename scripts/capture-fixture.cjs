const { app, BrowserWindow } = require("electron");
const { join } = require("node:path");

const outputPath = process.argv[2];
if (!outputPath) process.exit(2);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1000,
    height: 760,
    webPreferences: { sandbox: true },
  });
  await window.loadFile(
    join(__dirname, "../apps/desktop/demo/statics-problem.html"),
  );
  const image = await window.webContents.capturePage();
  require("node:fs").writeFileSync(outputPath, image.toPNG());
  window.destroy();
  app.quit();
});
