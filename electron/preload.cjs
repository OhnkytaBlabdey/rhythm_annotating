/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopRuntime", {
    isElectron: true,
    platform: process.platform,
    arch: process.arch,
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },
});
