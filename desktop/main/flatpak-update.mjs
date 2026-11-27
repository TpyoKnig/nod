import { connectSessionBus } from './session-bus.mjs';

const name = 'org.freedesktop.portal.Flatpak';
const monitorInterface = `${name}.UpdateMonitor`;
const signalType = 4;
const status = { running: 0, empty: 1, done: 2 };

function refused(error) {
  return /not allowed/i.test(error.message)
    ? new Error(
        'Your desktop does not let Nod update itself. Allow it in your privacy settings, or run flatpak permission-reset io.n8n.Nod and try again.',
        { cause: error },
      )
    : error;
}

export async function connectFlatpakPortal() {
  let path;
  let handlers = {};
  const bus = await connectSessionBus({
    onSignal: (message) => {
      if (message.path === path && message.type === signalType)
        handlers[message.member]?.(message.values[0] ?? {});
    },
  });
  const call = (target, interfaceName, member, signature, values) =>
    bus.call({
      destination: name,
      path: target,
      interface: interfaceName,
      member,
      signature,
      values,
    });
  try {
    [path] = await call('/org/freedesktop/portal/Flatpak', name, 'CreateUpdateMonitor', 'a{sv}', [
      {},
    ]);
  } catch (error) {
    bus.close();
    throw error;
  }
  return {
    onAvailable(handler) {
      handlers.UpdateAvailable = handler;
    },
    update(onProgress) {
      return new Promise((resolve, reject) => {
        handlers.Progress = (info) => {
          if (info.status === status.running) return onProgress(info.progress / 100);
          handlers.Progress = undefined;
          if (info.status === status.empty || info.status === status.done) resolve();
          else reject(refused(new Error(info.error_message || 'The Flatpak update failed.')));
        };
        call(path, monitorInterface, 'Update', 'sa{sv}', ['', {}]).catch((error) => {
          handlers.Progress = undefined;
          reject(refused(error));
        });
      });
    },
    close() {
      handlers = {};
      call(path, monitorInterface, 'Close', '', []).catch(() => {});
      bus.close();
    },
  };
}

export function createFlatpakUpdater({
  connect,
  source,
  currentVersion,
  restart,
  onStatus = () => {},
  installTimeout = 30 * 60 * 1000,
}) {
  const controller = new AbortController();
  let portal;
  let available;
  let ready;
  let checking;
  let restarting;
  let disposed = false;
  const started = connect().then((connected) => {
    portal = connected;
    if (disposed) return connected.close();
    connected.onAvailable((info) => {
      available = info['remote-commit'];
    });
  });
  started.catch(() => {});
  return {
    get ready() {
      return ready;
    },
    check() {
      if (disposed) return Promise.reject(new Error('Nod is closing.'));
      if (restarting) return Promise.reject(new Error('Nod is restarting.'));
      if (checking) return checking;
      checking = (async () => {
        onStatus('checking');
        await started;
        if (!available || available === ready?.commit) return ready;
        const candidate = await source.latest(currentVersion, controller.signal);
        if (candidate?.commit !== available) return ready;
        onStatus('downloading');
        let timer;
        await Promise.race([
          portal.update((progress) => onStatus('downloading', progress)),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    'The update did not finish. If your desktop asked to allow Nod to update itself, answer it and try again.',
                  ),
                ),
              installTimeout,
            );
            timer.unref?.();
          }),
        ]).finally(() => clearTimeout(timer));
        controller.signal.throwIfAborted();
        ready = { ...candidate };
        return ready;
      })().finally(() => {
        checking = undefined;
        onStatus(ready ? 'ready' : 'idle');
      });
      return checking;
    },
    restart() {
      if (checking) return Promise.reject(new Error('A desktop update check is still running.'));
      if (!ready || disposed) return Promise.reject(new Error('No desktop update is ready.'));
      if (restarting) return restarting;
      restarting = restart(ready).finally(() => {
        restarting = undefined;
      });
      return restarting;
    },
    dispose() {
      disposed = true;
      controller.abort();
      portal?.close();
      return checking?.catch(() => {});
    },
  };
}
