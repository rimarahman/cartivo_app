// Starts the built app (npm run build) on http://localhost:4600 for the server tests.
import { spawn } from "node:child_process";
import { loadTestEnv } from "./env.mjs";

const env = loadTestEnv();
const child = spawn(process.execPath, ["node_modules/@react-router/serve/bin.js", "./build/server/index.js"], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
