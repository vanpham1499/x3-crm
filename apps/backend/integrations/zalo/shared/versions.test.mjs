import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  RUNTIME_BUNDLE,
  SUPPORTED_BUNDLE_SHA256,
  SUPPORTED_VERSION,
  discoverInstalledVersions,
  inspectInstallation,
  readAsarEntry,
  reportInstallationCompatibility,
} from "./asar.mjs";
import {
  DEFAULT_VERSION_MANIFEST,
  assessVersionEvidence,
  getVersionManifest,
  loadVersionAdapter,
  registeredVersions,
} from "./versions/index.mjs";

function temporary(t) {
  const prefix = path.join(os.tmpdir(), "x3-zalo-versions-");
  const directory = fs.mkdtempSync(prefix);
  t.after(() => {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(path.resolve(prefix)))
      throw new Error("UNEXPECTED_TEST_CLEANUP_PATH");
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

function writeArchive(
  directory,
  { name = "Zalo", version = "26.9.10", source = null } = {},
) {
  const files = {
    "package.json": Buffer.from(JSON.stringify({ name, version })),
  };
  if (source !== null) files[RUNTIME_BUNDLE] = Buffer.from(source);
  const header = { files: {} },
    data = [];
  let offset = 0;
  for (const [entry, bytes] of Object.entries(files)) {
    let node = header;
    const parts = entry.split("/");
    parts.forEach((part, index) => {
      node.files ??= {};
      if (index === parts.length - 1)
        node.files[part] = { offset: String(offset), size: bytes.length };
      else node.files[part] ??= { files: {} };
      node = node.files[part];
    });
    offset += bytes.length;
    data.push(bytes);
  }
  const json = Buffer.from(JSON.stringify(header)),
    prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(json.length + 8, 4);
  prefix.writeUInt32LE(json.length, 12);
  const archive = path.join(directory, "resources", "app.asar");
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  fs.writeFileSync(archive, Buffer.concat([prefix, json, ...data]));
  return archive;
}

function knownEvidence() {
  const manifest = DEFAULT_VERSION_MANIFEST;
  return {
    productName: manifest.productName,
    version: manifest.version,
    bundle: manifest.bundle.path,
    sha256: manifest.bundle.sha256,
    presentMarkers: [...manifest.bundle.markers],
  };
}

test("registry pins exactly one verified version and preserves the legacy exports", () => {
  assert.deepEqual(registeredVersions(), ["26.9.10"]);
  assert.equal(SUPPORTED_VERSION, "26.9.10");
  assert.equal(
    SUPPORTED_BUNDLE_SHA256,
    "9cb9e2a9f45461d8e986a10dfad7c0edbe91577b16e2cb451ae6704028632c50",
  );
  const manifest = getVersionManifest("26.9.10");
  assert.equal(manifest.bundle.path, RUNTIME_BUNDLE);
  assert.equal(manifest.runtimeAdapter, "./26.9.10-adapter.mjs");
  assert.equal(manifest.requirements.nativePreload, true);
  assert.equal(manifest.requirements.browserCompatible, false);
  for (const version of [
    "26.9.11",
    "26.9",
    "26.9.10-beta",
    "26.9.10 ",
    "latest",
    "__proto__",
    null,
  ]) {
    assert.equal(getVersionManifest(version), null);
  }
  assert.throws(() => {
    manifest.bundle.sha256 = "0".repeat(64);
  }, TypeError);
  assert.throws(() => {
    manifest.bundle.markers.push("unverified");
  }, TypeError);
  registeredVersions().push("26.9.11");
  assert.equal(getVersionManifest("26.9.11"), null);
});

test("adapter loader is selected by the explicit version registry, never a caller-supplied path", async () => {
  const adapter = await loadVersionAdapter("26.9.10");
  assert.equal(adapter.manifest, DEFAULT_VERSION_MANIFEST);
  assert.equal(typeof adapter.runtimeExpression, "function");
  assert.equal(typeof adapter.runtimeCall, "function");
  assert.match(adapter.runtimeCall("getStatus"), /__x3ZaloNativeBridgeV1/);
  for (const version of [
    "26.9.11",
    "./runtime.mjs",
    "file:///tmp/untrusted.mjs",
    "__proto__",
  ]) {
    await assert.rejects(
      loadVersionAdapter(version),
      /UNSUPPORTED_ZALO_VERSION/,
    );
  }
});

test("approved evidence needs the exact version, path, digest and all native markers", () => {
  const fixture = knownEvidence();
  const matched = assessVersionEvidence(fixture);
  assert.equal(matched.status, "hash_matched");
  assert.equal(matched.compatible, true);
  assert.equal(matched.adapterId, "zalo-pc-26.9.10-native-v1");
  for (const changed of [
    { sha256: "0".repeat(64) },
    { bundle: "pc-dist/a-different-bundle.js" },
    { presentMarkers: fixture.presentMarkers.slice(1) },
    { productName: "AnotherProduct" },
  ]) {
    const report = assessVersionEvidence({ ...fixture, ...changed });
    assert.equal(report.status, "mismatch");
    assert.equal(report.compatible, false);
  }
  const unknown = assessVersionEvidence({ ...fixture, version: "26.9.11" });
  assert.equal(unknown.status, "unregistered");
  assert.equal(unknown.compatible, false);
  assert.equal(unknown.adapterId, null);
  assert.equal(unknown.expectedSha256, null);
});

test("same-version source change is hashed from bytes and rejected even with all old markers", (t) => {
  const directory = temporary(t);
  const source =
    DEFAULT_VERSION_MANIFEST.bundle.markers.join("\n") +
    "\nglobalThis.__zaloFixtureExecuted = true;";
  const archive = writeArchive(directory, { source });
  const before = fs.readFileSync(archive);
  const report = reportInstallationCompatibility(directory);
  assert.equal(report.status, "mismatch");
  assert.equal(report.reason, "bundle_hash_mismatch");
  assert.deepEqual(report.missingMarkers, []);
  assert.equal(
    report.sha256,
    createHash("sha256").update(source).digest("hex"),
  );
  assert.equal(globalThis.__zaloFixtureExecuted, undefined);
  assert.deepEqual(fs.readFileSync(archive), before);
  assert.throws(() => inspectInstallation(directory), /UNSUPPORTED_ZALO_BUILD/);
});

test("installed package version is discovered and unknown version cannot reuse an approved digest", (t) => {
  const directory = temporary(t);
  writeArchive(directory, { version: "26.9.11" });
  const report = reportInstallationCompatibility(directory);
  assert.equal(report.version, "26.9.11");
  assert.equal(report.status, "unregistered");
  assert.equal(report.sha256, null);
  assert.equal(report.bundle, null);
  assert.throws(
    () => inspectInstallation(directory),
    /UNSUPPORTED_ZALO_VERSION/,
  );
});

test("missing bundle, missing install, wrong product and corrupt archive all fail closed", (t) => {
  const directory = temporary(t);
  assert.equal(
    reportInstallationCompatibility(directory).status,
    "unavailable",
  );
  const archive = writeArchive(directory);
  assert.equal(
    reportInstallationCompatibility(directory).reason,
    "bundle_unreadable",
  );
  assert.throws(() => inspectInstallation(directory), /UNSUPPORTED_ZALO_BUILD/);
  writeArchive(directory, { name: "Other" });
  assert.equal(
    reportInstallationCompatibility(directory).reason,
    "wrong_product",
  );
  assert.throws(
    () => inspectInstallation(directory),
    /UNSUPPORTED_ZALO_VERSION/,
  );
  fs.writeFileSync(archive, Buffer.alloc(8));
  assert.throws(
    () => readAsarEntry(archive, "package.json"),
    /INVALID_ASAR_HEADER/,
  );
  assert.equal(
    reportInstallationCompatibility(directory).reason,
    "package_unreadable",
  );
  assert.throws(() => inspectInstallation(directory), /UNSUPPORTED_ZALO_BUILD/);
});

test("discovery lists program directories and reports their packaged versions without selecting a fallback", (t) => {
  const root = temporary(t);
  writeArchive(path.join(root, "Zalo-26.9.11"), { version: "26.9.11" });
  writeArchive(path.join(root, "Zalo-26.9.10"), { source: "different bytes" });
  writeArchive(path.join(root, "unrelated-profile"), {
    version: "sensitive-not-an-install",
  });
  fs.writeFileSync(path.join(root, "Zalo-26.9.12"), "not a directory");
  const reports = discoverInstalledVersions(root);
  assert.deepEqual(
    reports.map((report) => report.version),
    ["26.9.10", "26.9.11"],
  );
  assert.deepEqual(
    reports.map((report) => report.status),
    ["mismatch", "unregistered"],
  );
  assert.equal(
    reports.some((report) => report.compatible),
    false,
  );
  assert.deepEqual(discoverInstalledVersions(path.join(root, "missing")), []);
});

test("an explicitly selected isolated build passes the byte-level report without changing inspect's contract", (t) => {
  // Unit tests must never discover/read the user's host installation implicitly.
  const installation = process.env.ZALO_TEST_ISOLATED_INSTALLATION;
  if (!installation) {
    t.skip("No isolated test installation was explicitly selected.");
    return;
  }
  const report = reportInstallationCompatibility(installation);
  assert.equal(report.status, "hash_matched");
  assert.equal(report.compatible, true);
  assert.deepEqual(inspectInstallation(installation), {
    version: SUPPORTED_VERSION,
    bundle: RUNTIME_BUNDLE,
    sha256: SUPPORTED_BUNDLE_SHA256,
  });
});
