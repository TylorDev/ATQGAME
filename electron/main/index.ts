import { app, BrowserWindow } from "electron";
import { join } from "node:path";

type RendererLogLevel = "debug" | "info" | "warning" | "error";

function writeRendererLog(
  level: RendererLogLevel,
  message: string,
  sourceId: string,
  lineNumber: number,
): void {
  const location = sourceId ? ` (${sourceId}:${lineNumber})` : "";
  const formattedMessage = `[Renderer] [${level}] ${message}${location}`;

  switch (level) {
    case "debug":
      console.debug(formattedMessage);
      break;
    case "warning":
      console.warn(formattedMessage);
      break;
    case "error":
      console.error(formattedMessage);
      break;
    default:
      console.info(formattedMessage);
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#101722",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    "console-message",
    ({ level, message, lineNumber, sourceId }) => {
      writeRendererLog(level, message, sourceId, lineNumber);
    },
  );

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
