const { spawn } = require("child_process");
const path = require("path");

const mcTestDir = path.resolve(__dirname, "../../mc-test/mission-control");
const nextBin = path.join(mcTestDir, "node_modules/next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "dev", "--port", "3100"], {
  cwd: mcTestDir,
  stdio: "inherit",
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code ?? 0));
