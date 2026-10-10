// Narrow, read-only projection in the project's own browser profile.
// IDs come from the Web bundle inspected on 30/09/2026; fail closed on drift.
export async function inspect(page) {
  const results = [];
  for (const frame of page.frames()) {
    if (!/^https:\/\/(chat|id)\.zalo\.me\//.test(frame.url())) continue;
    const result = await frame.evaluate(() => {
      const host = location.hostname;
      if (!["chat.zalo.me", "id.zalo.me"].includes(host))
        return { state: "blocked", error: "WEB_UNEXPECTED_PAGE" };
      if (
        document.querySelector("#conversationList") &&
        Array.isArray(globalThis.webpackJsonp)
      ) {
        let require;
        const id = "zalo-team-status-" + Date.now();
        const chunk = [[id], { [id]: (m, e, r) => (require = r) }, [[id]]];
        globalThis.webpackJsonp.push(chunk);
        if (!require) return { state: "connecting" };
        delete require.c[id];
        delete require.m[id];
        const index = globalThis.webpackJsonp.indexOf(chunk);
        if (index >= 0) globalThis.webpackJsonp.splice(index, 1);
        const store = require.c.dThN?.exports.default,
          transport = require.c.fdn9?.exports.a;
        const uid = String(store?.userId || "");
        const profile = require.c.JWY6?.exports.a?._cacheProfileInfo?.[uid];
        const avatar =
          require.c.UiPd?.exports.default?.getAvatar?.(uid) || profile?.avatar;
        const name =
          profile?.displayName ||
          profile?.zaloName ||
          profile?.dName ||
          require.c.DiYL?.exports.a?.displayName;
        if (!uid || transport?.userId !== store?.userId)
          return { state: "connecting", error: "WEB_ADAPTER_NOT_READY" };
        return {
          state:
            transport.socket?._authenticated === true &&
            transport.socket?.getSocketState?.() === 1
              ? "connected"
              : "offline",
          externalId: uid,
          avatarSrc:
            typeof avatar === "string" && /^https:\/\//.test(avatar)
              ? avatar
              : undefined,
          name: typeof name === "string" ? name.slice(0, 120) : null,
        };
      }
      const text = document.body?.innerText || "";
      if (/captcha|kiểm tra bảo mật|xác minh bạn là con người/i.test(text))
        return { state: "blocked", error: "WEB_VERIFICATION_REQUIRED" };
      if (/mã qr.{0,30}hết hạn|qr code.{0,30}expired/i.test(text))
        return { state: "expired" };
      if (
        /xác nhận.{0,50}(điện thoại|thiết bị)|kiểm tra.{0,30}điện thoại|đang chờ xác nhận/i.test(
          text,
        )
      )
        return { state: "confirming" };
      const svg = document.querySelector(".qr-container svg");
      if (svg && svg.getBoundingClientRect().width > 100) {
        const expired = document.querySelector(".qrcode-expired");
        if (expired && expired.getBoundingClientRect().height > 0)
          return { state: "expired" };
        return { state: "waiting_scan", qrSelector: ".qr-container svg" };
      }
      if (
        host === "id.zalo.me" ||
        document.querySelector("#qrcode, .qrcode, .qr-code")
      ) {
        for (const e of document.querySelectorAll("canvas,img")) {
          const b = e.getBoundingClientRect();
          if (
            b.width < 150 ||
            b.height < 150 ||
            b.width > 500 ||
            Math.abs(b.width - b.height) > 10
          )
            continue;
          const qr =
            e.tagName === "CANVAS"
              ? e.toDataURL("image/png")
              : e.getAttribute("src");
          if (
            typeof qr === "string" &&
            /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr) &&
            qr.length < 250000
          )
            return { state: "waiting_scan", qr };
        }
      }
      return { state: "connecting" };
    });
    if (result.qrSelector) {
      const png = await frame
        .locator(result.qrSelector)
        .screenshot({ type: "png", timeout: 3000 });
      result.qr = "data:image/png;base64," + png.toString("base64");
      delete result.qrSelector;
    }
    results.push(result);
  }
  const active =
    results.find((r) => r.state === "connected") ||
    results.find((r) => r.state === "waiting_scan") ||
    results.find((r) => r.state === "confirming") ||
    results.find((r) => r.state === "blocked") ||
    results.find((r) => r.state === "offline");
  return (
    active ||
    results.find((r) => r.state === "expired") || { state: "connecting" }
  );
}
