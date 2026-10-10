import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  DEFAULT_VERSION_MANIFEST,
  assessVersionEvidence,
  getVersionManifest,
} from "./versions/index.mjs";

// Compatibility exports for the current native runtime adapter and its callers.
export const SUPPORTED_VERSION = DEFAULT_VERSION_MANIFEST.version;
export const SUPPORTED_BUNDLE_SHA256 = DEFAULT_VERSION_MANIFEST.bundle.sha256;
export const RUNTIME_BUNDLE = DEFAULT_VERSION_MANIFEST.bundle.path;
export const DEFAULT_INSTALLATION =
  "C:/Users/Admin/AppData/Local/Programs/Zalo/Zalo-26.9.10";

/** Read packaged source as bytes; never require/evaluate vendor code from disk. */
export function readAsarEntry(archive, entry) {
  const fd = fs.openSync(archive, "r");
  try {
    const prefix = Buffer.alloc(16);
    if (fs.readSync(fd, prefix, 0, 16, 0) !== 16)
      throw new Error("INVALID_ASAR_HEADER");
    const length = prefix.readUInt32LE(12);
    const dataBase = 8 + prefix.readUInt32LE(4);
    const fileSize = fs.fstatSync(fd).size;
    if (
      !length ||
      length > 16 * 1024 * 1024 ||
      dataBase < 16 + length ||
      dataBase > fileSize
    )
      throw new Error("INVALID_ASAR_HEADER");
    const header = Buffer.alloc(length);
    if (fs.readSync(fd, header, 0, length, 16) !== length)
      throw new Error("INVALID_ASAR_HEADER");
    let node = JSON.parse(header.toString("utf8"));
    for (const part of entry.split("/")) node = node?.files?.[part];
    if (
      !node ||
      node.unpacked ||
      !Number.isSafeInteger(node.size) ||
      node.size < 0 ||
      node.size > 256 * 1024 * 1024
    )
      throw new Error("ASAR_ENTRY_UNAVAILABLE");
    const offset = Number(node.offset);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      dataBase + offset + node.size > fileSize
    )
      throw new Error("INVALID_ASAR_ENTRY");
    const bytes = Buffer.alloc(node.size);
    let read = 0;
    while (read < bytes.length) {
      const count = fs.readSync(
        fd,
        bytes,
        read,
        bytes.length - read,
        dataBase + offset + read,
      );
      if (!count) throw new Error("INVALID_ASAR_ENTRY");
      read += count;
    }
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

/** No execution, extraction, profile reads, network calls or installation writes. */
export function reportInstallationCompatibility(
  installationDir = DEFAULT_INSTALLATION,
) {
  const archive = path.join(installationDir, "resources", "app.asar");
  let pkg;
  try {
    pkg = JSON.parse(readAsarEntry(archive, "package.json"));
  } catch (error) {
    return {
      compatible: false,
      status: "unavailable",
      version: null,
      adapterId: null,
      bundle: null,
      sha256: null,
      expectedSha256: null,
      missingMarkers: [],
      requirements: null,
      reason:
        error.code === "ENOENT"
          ? "installation_not_found"
          : "package_unreadable",
    };
  }
  const version = typeof pkg?.version === "string" ? pkg.version : null;
  const manifest = getVersionManifest(version);
  const evidence = { productName: pkg?.name, version };
  // Unknown versions are reported without guessing which of their bundles to trust.
  if (pkg?.name !== "Zalo" || !manifest) return assessVersionEvidence(evidence);
  let bytes;
  try {
    bytes = readAsarEntry(archive, manifest.bundle.path);
  } catch {
    return {
      ...assessVersionEvidence(evidence),
      status: "mismatch",
      reason: "bundle_unreadable",
    };
  }
  return assessVersionEvidence({
    ...evidence,
    bundle: manifest.bundle.path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    presentMarkers: manifest.bundle.markers.filter((marker) =>
      bytes.includes(marker),
    ),
  });
}

/** Enumerate program installation directories only; never select, launch or upgrade one. */
export function discoverInstalledVersions(
  installationRoot = path.dirname(DEFAULT_INSTALLATION),
) {
  let entries;
  try {
    entries = fs.readdirSync(installationRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error("INSTALLATION_DISCOVERY_FAILED");
  }
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() && /^Zalo-\d+(?:\.\d+){1,3}$/.test(entry.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((entry) => {
      const installationDir = path.resolve(installationRoot, entry.name);
      return {
        installationDir,
        ...reportInstallationCompatibility(installationDir),
      };
    });
}

export function inspectInstallation(installationDir = DEFAULT_INSTALLATION) {
  const report = reportInstallationCompatibility(installationDir);
  if (report.status === "unregistered" || report.reason === "wrong_product")
    throw new Error("UNSUPPORTED_ZALO_VERSION");
  if (!report.compatible) throw new Error("UNSUPPORTED_ZALO_BUILD");
  return {
    version: report.version,
    bundle: report.bundle,
    sha256: report.sha256,
  };
}
