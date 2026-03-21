/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const RENDERER_DIR_NAME = "dist-desktop-renderer";

function resolveRendererIndexHtml() {
    const candidateRoots = app.isPackaged
        ? [
              path.join(process.resourcesPath, RENDERER_DIR_NAME),
              path.join(app.getAppPath(), RENDERER_DIR_NAME),
          ]
        : [
              path.join(app.getAppPath(), RENDERER_DIR_NAME),
              path.join(process.cwd(), RENDERER_DIR_NAME),
          ];

    for (const root of candidateRoots) {
        const candidate = path.join(root, "index.html");
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    throw new Error(
        `Unable to locate desktop renderer output. Expected ${RENDERER_DIR_NAME}/index.html.`,
    );
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1600,
        height: 960,
        minWidth: 1180,
        minHeight: 720,
        autoHideMenuBar: true,
        backgroundColor: "#f8f1e7",
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: "deny" };
    });

    win.loadFile(resolveRendererIndexHtml()).catch((error) => {
        console.error("Failed to load desktop renderer", error);
    });
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
