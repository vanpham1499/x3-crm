import fs from "node:fs/promises";
import crypto from "node:crypto";
const dir = new URL("../.local/", import.meta.url);
await fs.mkdir(dir, { recursive: true });
try {
  await fs.writeFile(
    new URL("web-token", dir),
    crypto.randomBytes(32).toString("hex"),
    { flag: "wx", mode: 0o600 },
  );
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
console.log(
  "Web connector secret prepared. Start with docker compose -f tooling/zalo-team/web/compose.yml up -d --build",
);
