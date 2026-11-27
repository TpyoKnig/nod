import { app } from 'electron';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const flatpak = () => process.env.FLATPAK_ID === 'io.n8n.Nod';
const linuxPackage = () =>
  flatpak() ? 'flatpak' : process.env.NOD_PACKAGE === 'rpm' ? 'rpm' : null;
const autostartEntry = () =>
  flatpak()
    ? '[Desktop Entry]\nType=Application\nName=Nod\nExec=flatpak run io.n8n.Nod\nX-Flatpak=io.n8n.Nod\n'
    : '[Desktop Entry]\nType=Application\nName=Nod\nExec=nod\n';
const autostartPath = () =>
  join(
    (flatpak() ? process.env.HOST_XDG_CONFIG_HOME : process.env.XDG_CONFIG_HOME) ||
      join(homedir(), '.config'),
    'autostart',
    'io.n8n.Nod.desktop',
  );
const essentialAutostartKeys = () => (flatpak() ? ['Type', 'Exec', 'X-Flatpak'] : ['Type', 'Exec']);

function parseDesktopEntry(text) {
  const fields = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf('=');
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[') || separator === -1)
      continue;
    fields[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return fields;
}

function linuxAutostartState() {
  let text;
  try {
    text = readFileSync(autostartPath(), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { present: false, stale: false };
    throw error;
  }
  const actual = parseDesktopEntry(text);
  const expected = parseDesktopEntry(autostartEntry());
  const stale = essentialAutostartKeys().some((key) => actual[key] !== expected[key]);
  return { present: true, stale };
}

function writeAutostartAtomically() {
  const path = autostartPath();
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}`;
  writeFileSync(tempPath, autostartEntry());
  renameSync(tempPath, path);
}

export function opensAtLogin() {
  if (process.platform !== 'linux') {
    const login = app.getLoginItemSettings();
    return process.platform === 'win32' ? login.executableWillLaunchAtLogin : login.openAtLogin;
  }
  return linuxAutostartState().present;
}

export function setOpenAtLogin(open) {
  if (process.platform !== 'linux') return app.setLoginItemSettings({ openAtLogin: open });
  if (!open) return rmSync(autostartPath(), { force: true });
  if (!linuxPackage()) throw new Error('Open at login needs the Flatpak or the RPM package.');
  writeAutostartAtomically();
}

export function repairStaleAutostart() {
  if (process.platform !== 'linux' || !linuxPackage()) return false;
  const state = linuxAutostartState();
  if (!state.present || !state.stale) return false;
  writeAutostartAtomically();
  return true;
}
