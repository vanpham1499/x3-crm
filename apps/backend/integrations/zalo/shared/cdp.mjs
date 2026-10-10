import { EventEmitter } from "node:events";

export function loopbackUrl(value) {
  const url = new URL(value);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error("CDP_MUST_BE_LOOPBACK");
  if (!["http:", "ws:"].includes(url.protocol))
    throw new Error("INVALID_CDP_PROTOCOL");
  return url;
}

export async function listTargets(endpoint) {
  const url = loopbackUrl(endpoint);
  url.pathname = "/json/list";
  url.search = "";
  url.hash = "";
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("CDP_LIST_FAILED");
  const targets = await response.json();
  return targets.filter(
    (t) => t.type === "page" && typeof t.webSocketDebuggerUrl === "string",
  );
}

export class CdpConnection extends EventEmitter {
  constructor(url) {
    super();
    this.url = loopbackUrl(url).href;
    this.pending = new Map();
    this.nextId = 0;
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.close();
        reject(new Error("CDP_CONNECT_TIMEOUT"));
      }, 5000);
      this.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      this.socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("CDP_CONNECT_FAILED"));
        },
        { once: true },
      );
    });
    this.socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.id) {
        const p = this.pending.get(message.id);
        if (!p) return;
        this.pending.delete(message.id);
        clearTimeout(p.timer);
        if (message.error)
          p.reject(new Error(`CDP_ERROR_${message.error.code}`));
        else p.resolve(message.result);
      } else if (message.method) this.emit(message.method, message.params);
    });
    this.socket.addEventListener("close", () => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("CDP_DISCONNECTED"));
      }
      this.pending.clear();
      this.emit("disconnected");
    });
    return this;
  }
  send(method, params = {}, timeout = 10000) {
    if (this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error("CDP_NOT_CONNECTED"));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("CDP_COMMAND_TIMEOUT"));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, timeout = 10000) {
    const result = await this.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
        userGesture: false,
      },
      timeout,
    );
    // Do not propagate vendor exception text: it may contain an endpoint or message content.
    if (result.exceptionDetails) throw new Error("NATIVE_EVALUATION_FAILED");
    return result.result?.value;
  }
  close() {
    this.socket?.close();
  }
}
