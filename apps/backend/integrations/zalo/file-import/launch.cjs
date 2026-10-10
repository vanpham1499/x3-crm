const { spawnSync } = require("node:child_process");
const path = require("node:path");
const [php, backend, owner, log] = process.argv.slice(2);
if (!/^[a-f0-9]{64}$/.test(owner || "")) process.exit(1);
// A hidden console lets PHP CLI's CMD children inherit the same hidden window.
const result = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-WindowStyle",
    "Hidden",
    "-File",
    path.join(__dirname, "launch.ps1"),
    "-Php",
    php,
    "-Backend",
    backend,
    "-Owner",
    owner,
    "-Log",
    log,
  ],
  { windowsHide: true, shell: false, stdio: "ignore" },
);
if (result.error || result.status !== 0) process.exit(1);
