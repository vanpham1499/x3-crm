import fs from 'node:fs/promises';
import { CallConnector, attachNativeRelay } from './connector-client.mjs';
import { NativeCallSession } from './native-session.mjs';

// Prepared only after the audio adapter has verified the two virtual endpoints.
// All controls stay in Chrome; this is the worker's native protocol adapter.
export async function prepareWindowsCall(scope, onFailure) {
  if (process.platform !== 'win32' || !process.env.CALL_NATIVE_ENGINE) throw Error('WINDOWS_CALL_NOT_CONFIGURED');
  const connector = new CallConnector({ ...scope, token: (await fs.readFile(process.env.CALL_CONNECTOR_TOKEN_FILE, 'utf8')).trim() });
  const native = new NativeCallSession(process.env.CALL_NATIVE_ENGINE);
  let stopRelay, closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    // Connector disposal requests remote end using the recorded native callId.
    // Stop media/process immediately, even if the remote network is unavailable.
    stopRelay?.(); await native.close(); await connector.close();
  };
  try {
    const metadata = await connector.prepare();
    await native.start(metadata);
    await native.configureVirtualDevices({ inputName: process.env.CALL_ENGINE_INPUT, outputName: process.env.CALL_ENGINE_OUTPUT });
    stopRelay = attachNativeRelay(native, connector, onFailure);
    return { start() { if (closed) throw Error('CALL_SESSION_CLOSED'); native.makeCall(); }, close };
  } catch (error) { await close().catch(() => {}); throw error; }
}
