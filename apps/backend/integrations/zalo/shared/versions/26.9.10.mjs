// This manifest belongs to the CRM workspace, not the Zalo installation.
// Register a new version only with its verified runtime adapter and regression evidence.
const manifest = {
  schemaVersion: 1,
  adapterId: "zalo-pc-26.9.10-native-v1",
  productName: "Zalo",
  version: "26.9.10",
  runtimeAdapter: "./26.9.10-adapter.mjs",
  bundle: {
    path: "pc-dist/lazy/default-login-main-startup-shared-worker-znotification.cfb8c4aa40daa0a87751.js",
    sha256: "9cb9e2a9f45461d8e986a10dfad7c0edbe91577b16e2cb451ae6704028632c50",
    markers: [
      "_processChatMessages(",
      "sendMsgObject(",
      "processOnlineE2eeMsg(",
      "sendMessageE2ee(",
    ],
  },
  requirements: {
    host: "zalo-pc-electron",
    nativePreload: true,
    globals: ["$zelectron", "webpackJsonp"],
    session: "independently-authenticated-native-account",
    browserCompatible: false,
  },
  moduleIds: {
    fetcher: "dThN",
    chatHandler: "fdn9",
    messageModel: "4HQc",
    constants: "1pet",
    signalProtocolManager: "GpwQ",
    utilities: "z0WU",
    clientIds: "NMlV",
    chatService: "tcV9",
    configuration: "NDmK",
  },
};

function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export default freeze(manifest);
