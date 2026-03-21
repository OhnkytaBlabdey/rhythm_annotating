import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const rendererOutDir = path.join(repoRoot, "dist-desktop-renderer");
const nextOutDir = path.join(repoRoot, "out");

function getPnpmCommand() {
    return "pnpm";
}

function run(command, args, env = {}) {
    const isWindows = process.platform === "win32";
    const executable = isWindows ? "cmd.exe" : command;
    const finalArgs = isWindows
        ? ["/d", "/s", "/c", command, ...args]
        : args;

    return new Promise((resolve, reject) => {
        const child = spawn(executable, finalArgs, {
            cwd: repoRoot,
            stdio: "inherit",
            shell: false,
            env: {
                ...process.env,
                ...env,
            },
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
        });
    });
}

async function main() {
    rmSync(rendererOutDir, { recursive: true, force: true });
    await run(getPnpmCommand(), ["build"], {
        BUILD_TARGET: "desktop",
    });

    if (!existsSync(nextOutDir)) {
        throw new Error("Next.js desktop export output was not generated.");
    }

    mkdirSync(rendererOutDir, { recursive: true });
    cpSync(nextOutDir, rendererOutDir, {
        recursive: true,
        force: true,
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
