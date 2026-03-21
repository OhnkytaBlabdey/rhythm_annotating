module.exports = {
    packagerConfig: {
        asar: true,
        prune: false,
        executableName: "rhythm-annotating",
        ignore: [
            /^\/\.git($|\/)/,
            /^\/\.github($|\/)/,
            /^\/\.next($|\/)/,
            /^\/node_modules($|\/)/,
            /^\/other($|\/)/,
            /^\/out($|\/)/,
            /^\/public($|\/)/,
            /^\/src($|\/)/,
            /^\/test($|\/)/,
        ],
        extraResource: ["./dist-desktop-renderer"],
        osxSign: false,
        osxNotarize: false,
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin", "linux", "win32"],
        },
    ],
};
