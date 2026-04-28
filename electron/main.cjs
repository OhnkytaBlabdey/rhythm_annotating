/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, net, protocol, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const APP_PROTOCOL = "app";
const APP_PROTOCOL_HOST = "-";
const RENDERER_DIR_NAME = "dist-desktop-renderer";

protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_PROTOCOL,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
        },
    },
]);

function resolveRendererRoot() {
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
            return root;
        }
    }

    throw new Error(
        `Unable to locate desktop renderer output. Expected ${RENDERER_DIR_NAME}/index.html.`,
    );
}

function resolveRequestPath(requestUrl) {
    const { pathname } = new URL(requestUrl);

    if (!pathname || pathname === "/") {
        return "/index.html";
    }

    return decodeURIComponent(pathname);
}

function resolveRendererAssetPath(rendererRoot, requestUrl) {
    const requestedPath = resolveRequestPath(requestUrl);
    const root = path.resolve(rendererRoot);
    const candidate = path.resolve(root, `.${requestedPath}`);
    const relative = path.relative(root, candidate);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return null;
    }

    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
    }

    if (!path.extname(candidate)) {
        const htmlCandidate = `${candidate}.html`;
        if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
            return htmlCandidate;
        }

        const indexCandidate = path.join(candidate, "index.html");
        if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
            return indexCandidate;
        }
    }

    return null;
}

function registerRendererProtocol(rendererRoot) {
    protocol.handle(APP_PROTOCOL, (request) => {
        const assetPath = resolveRendererAssetPath(rendererRoot, request.url);

        if (!assetPath) {
            return new Response("Not Found", { status: 404 });
        }

        return net.fetch(pathToFileURL(assetPath).toString());
    });
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

    win.loadURL(`${APP_PROTOCOL}://${APP_PROTOCOL_HOST}/index.html`).catch((error) => {
        console.error("Failed to load desktop renderer", error);
    });
}

app.whenReady().then(() => {
    registerRendererProtocol(resolveRendererRoot());
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
