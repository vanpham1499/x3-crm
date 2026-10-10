import native26910 from "./26.9.10.mjs";

// Explicit imports are intentional. No directory scan, wildcard version, nearest
// version fallback, remote manifest, or automatic approval of a changed build.
const registry = Object.freeze({
  [native26910.version]: Object.freeze({
    manifest: native26910,
    load: () => import("./26.9.10-adapter.mjs"),
  }),
});
export const DEFAULT_VERSION_MANIFEST = native26910;

export function getVersionManifest(version) {
  return typeof version === "string" && Object.hasOwn(registry, version)
    ? registry[version].manifest
    : null;
}

export function registeredVersions() {
  return Object.keys(registry);
}

/** Only the explicit registry can select trusted adapter code in this workspace. */
export async function loadVersionAdapter(version) {
  const manifest = getVersionManifest(version);
  if (!manifest) throw new Error("UNSUPPORTED_ZALO_VERSION");
  const adapter = await registry[version].load();
  if (
    typeof adapter.runtimeExpression !== "function" ||
    typeof adapter.runtimeCall !== "function"
  )
    throw new Error("UNSUPPORTED_ZALO_ADAPTER");
  return Object.freeze({
    manifest,
    runtimeExpression: adapter.runtimeExpression,
    runtimeCall: adapter.runtimeCall,
  });
}

/** Compare public installation metadata only. Hashes must come from packaged bytes. */
export function assessVersionEvidence({
  productName,
  version,
  bundle,
  sha256,
  presentMarkers = [],
}) {
  const manifest = getVersionManifest(version);
  const base = {
    compatible: false,
    version: typeof version === "string" ? version : null,
    adapterId: manifest?.adapterId ?? null,
    bundle: manifest?.bundle.path ?? null,
    sha256: typeof sha256 === "string" ? sha256 : null,
    expectedSha256: manifest?.bundle.sha256 ?? null,
    missingMarkers: [],
    requirements: manifest?.requirements ?? null,
  };
  if (productName !== "Zalo") {
    return { ...base, status: "mismatch", reason: "wrong_product" };
  }
  if (!manifest) {
    return { ...base, status: "unregistered", reason: "unregistered_version" };
  }
  const observed = new Set(presentMarkers);
  const missingMarkers = manifest.bundle.markers.filter(
    (marker) => !observed.has(marker),
  );
  if (bundle !== manifest.bundle.path) {
    return {
      ...base,
      missingMarkers,
      status: "mismatch",
      reason: "bundle_path_mismatch",
    };
  }
  if (sha256 !== manifest.bundle.sha256) {
    return {
      ...base,
      missingMarkers,
      status: "mismatch",
      reason: "bundle_hash_mismatch",
    };
  }
  if (missingMarkers.length) {
    return {
      ...base,
      missingMarkers,
      status: "mismatch",
      reason: "bundle_markers_missing",
    };
  }
  return { ...base, compatible: true, status: "hash_matched", reason: null };
}
