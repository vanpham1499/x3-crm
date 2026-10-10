// Phone transfer capabilities of the authenticated Web runtime. Never override
// vendor feature flags/ranges or export session keys from the browser.
export function validHistorySync(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ["status", "start", "cancel"].includes(value.operation) &&
    Object.keys(value).every((k) => ["operation", "id"].includes(k)) &&
    (value.id === undefined
      ? value.operation === "status"
      : typeof value.id === "string" && /^[a-f0-9-]{36}$/.test(value.id))
  );
}

export async function historySync(
  page,
  expectedId,
  { sync = { operation: "status" } } = {},
) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_SYNC_NOT_READY");
  return frame.evaluate(
    async ({ expectedId, sync }) => {
      let require;
      const id = "zalo-team-history-sync-" + Date.now();
      const chunk = [
        [id],
        {
          [id]: (m, e, r) => {
            require = r;
          },
        },
        [[id]],
      ];
      if (!Array.isArray(globalThis.webpackJsonp))
        throw Error("WEB_SYNC_NOT_READY");
      globalThis.webpackJsonp.push(chunk);
      if (!require) throw Error("WEB_SYNC_NOT_READY");
      delete require.c[id];
      delete require.m[id];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      // Capabilities must describe initialized modules, not initialize a sync flow.
      const get = (k) => require.c[k]?.exports;
      if (
        String(get("dThN")?.default?.userId) !== expectedId ||
        String(get("fdn9")?.a?.userId) !== expectedId
      )
        throw Error("WEB_IDENTITY_MISMATCH");
      const api = get("Qx9e"),
        container = get("jDHv")?.ModuleContainer;
      const unavailable = {
        available: false,
        reason: "WEB_SYNC_RUNTIME_UNAVAILABLE",
        pcRequired: false,
        job: null,
      };
      if (!api?.SyncController || !container) return unavailable;
      let controller, config;
      try {
        controller = container.resolve(api.SyncController);
        config = container.resolve(api.SyncConfigService);
      } catch {
        return unavailable;
      }
      const source = api.SyncSource?.MANUAL;
      if (
        source === undefined ||
        api.CanSyncResult?.OK === undefined ||
        typeof controller?.canSync !== "function" ||
        typeof config?.getThresholdRanges !== "function"
      )
        return unavailable;
      const result = controller.canSync(source);
      const available = result === api.CanSyncResult?.OK;
      const reason = available
        ? null
        : Object.entries(api.CanSyncResult || {}).find(
            ([key, value]) => !/^\d+$/.test(key) && value === result,
          )?.[0] || "WEB_SYNC_NOT_READY";
      const ranges = config.getThresholdRanges(source);
      const range = (value) =>
        Number.isSafeInteger(value?.fromTs) &&
        value.fromTs >= 0 &&
        Number.isSafeInteger(value?.toTs) &&
        value.toTs >= value.fromTs
          ? { fromTs: value.fromTs, toTs: value.toTs }
          : null;
      const capabilities = {
        available,
        reason,
        pcRequired: false,
        workerReady: controller.isWorkerReady?.() === true,
        running: controller.machine?.isRunning?.() === true,
        ranges: {
          conversations: range(ranges?.conversationsList),
          recent: range(ranges?.previewAndRecentMessages),
          other: range(ranges?.otherMessages),
        },
      };
      const key = "__zaloTeamPhoneTransfer";
      let store = globalThis[key];
      if (store && store.account !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      if (!store)
        store = globalThis[key] = { account: expectedId, jobs: new Map() };
      let job = sync.id ? store.jobs.get(sync.id) : null;
      const session = () =>
        controller.machine?.getCurrentSyncMachineInfo?.()?.userSyncSessionId;
      const owned = (j) => j && j.nativeId && j.nativeId === session();
      const finish = (j, state, error = null) => {
        if (owned(j))
          j.batches = Math.max(
            0,
            (controller.syncEventsHandler?.receivedBatchCount || 0) -
              j.baseline,
          );
        j.state = state;
        j.error = error;
        j.finishedAt = Date.now();
        for (const [event, fn] of j.listeners)
          controller.removeEventListener(event, fn);
        j.listeners = [];
      };
      if (sync.operation === "start" && !job) {
        if (!available) throw Error("WEB_SYNC_NOT_READY");
        if (
          typeof controller.sync !== "function" ||
          typeof controller.addEventListener !== "function" ||
          typeof controller.removeEventListener !== "function" ||
          !api.SyncMessageEvent?.ON_SUCCESS ||
          typeof controller.cancelSyncIfRunning !== "function"
        )
          throw Error("WEB_SYNC_RUNTIME_UNAVAILABLE");
        job = {
          id: sync.id,
          state: "running",
          startedAt: Date.now(),
          finishedAt: null,
          error: null,
          nativeId: null,
          listeners: [],
          baseline: controller.syncEventsHandler?.receivedBatchCount || 0,
          batches: 0,
        };
        store.jobs.set(sync.id, job);
        const listen = (event, fn) => {
          job.listeners.push([event, fn]);
          controller.addEventListener(event, fn);
        };
        const target = job;
        listen(api.SyncMessageEvent.ON_SUCCESS, (event) => {
          if (!owned(target)) return;
          finish(
            target,
            event.getSuccessType?.() === api.SyncSuccessType?.NO_NEED_SYNC
              ? "no_changes"
              : "received",
          );
        });
        listen(api.SyncMessageEvent.ON_FAILED, (event) => {
          if (!owned(target)) return;
          const code = event.getErrorCode?.();
          finish(target, "failed", Number.isSafeInteger(code) ? code : null);
        });
        try {
          // Capture the native session immediately: sync() starts the machine synchronously.
          const pending = controller.sync(source);
          job.nativeId = session();
          await pending;
          if (!job.nativeId) finish(job, "failed");
        } catch {
          finish(job, "failed");
        }
        for (const [id, old] of store.jobs) {
          if (store.jobs.size <= 20) break;
          if (old !== job && old.state !== "running") store.jobs.delete(id);
        }
      }
      if (job?.state === "running") {
        if (!owned(job)) finish(job, "interrupted");
        else {
          job.batches = Math.max(
            0,
            (controller.syncEventsHandler?.receivedBatchCount || 0) -
              job.baseline,
          );
          if (
            sync.operation === "cancel" ||
            Date.now() - job.startedAt > 30 * 60 * 1000
          ) {
            await controller.cancelSyncIfRunning(
              api.SyncCancelReason.USER_CANCELLED,
            );
            finish(
              job,
              sync.operation === "cancel" ? "cancelled" : "interrupted",
            );
          }
        }
      }
      // Never return machine context: it contains ephemeral encryption material.
      const phase =
        job?.state === "running" && owned(job)
          ? JSON.stringify(
              controller.machine?.interpreter?.state?.value ?? "running",
            ).slice(0, 300)
          : null;
      return {
        ...capabilities,
        job: job
          ? {
              id: job.id,
              state: job.state,
              startedAt: job.startedAt,
              finishedAt: job.finishedAt,
              error: job.error,
              batches: job.batches,
              phase,
            }
          : null,
      };
    },
    { expectedId, sync },
  );
}
