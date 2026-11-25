import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const bundleName = 'nod-linux-x64.flatpak';
const manifestName = 'release-linux-x64.json';
const checksumsName = 'SHA256SUMS-linux-x64';
const sizeLimit = 1900 * 1024 ** 2;
const digestPattern = /^[a-f0-9]{64}$/;

async function digest(path) {
  const value = createHash('sha256');
  for await (const chunk of createReadStream(path)) value.update(chunk);
  return value.digest('hex');
}

export async function packageLinuxBundle({ root, bundle, version, source, commit }) {
  const bytes = (await stat(bundle)).size;
  if (bytes <= 0 || bytes > sizeLimit)
    throw new Error('The Linux bundle must fit in one release file of at most 1900 MiB.');
  const directory = join(root, 'dist/desktop/linux-x64');
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await copyFile(bundle, join(directory, bundleName));
  const manifest = {
    platform: 'linux-x64',
    version,
    source,
    commit,
    bundle: { file: bundleName, bytes, sha256: await digest(bundle) },
  };
  await writeFile(join(directory, manifestName), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(directory, checksumsName), `${manifest.bundle.sha256}  ${bundleName}\n`);
  await linuxReleaseFiles(root, { version, source });
}

export async function linuxReleaseFiles(root, { version, source }) {
  const directory = join(root, 'dist/desktop/linux-x64');
  const manifest = JSON.parse(await readFile(join(directory, manifestName), 'utf8'));
  if (
    !/^\d+\.\d+\.\d+$/.test(version || '') ||
    !/^[a-f0-9]{40}$/.test(source || '') ||
    manifest.platform !== 'linux-x64' ||
    manifest.version !== version ||
    manifest.source !== source ||
    !digestPattern.test(manifest.commit || '') ||
    manifest.bundle?.file !== bundleName ||
    !digestPattern.test(manifest.bundle.sha256 || '') ||
    !Number.isSafeInteger(manifest.bundle.bytes) ||
    manifest.bundle.bytes <= 0
  )
    throw new Error('The Linux release does not match its source or Flatpak commit.');
  if (manifest.bundle.bytes > sizeLimit)
    throw new Error('The Linux bundle must fit in one release file of at most 1900 MiB.');
  const path = join(directory, bundleName);
  if (
    (await stat(path)).size !== manifest.bundle.bytes ||
    (await digest(path)) !== manifest.bundle.sha256
  )
    throw new Error('The Linux bundle failed its checksum.');
  if (
    (await readFile(join(directory, checksumsName), 'utf8')) !==
    `${manifest.bundle.sha256}  ${bundleName}\n`
  )
    throw new Error('The Linux checksums do not match.');
  return [manifestName, checksumsName, bundleName].map((file) => join(directory, file));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await packageLinuxBundle({
    root: process.cwd(),
    bundle: resolve('.local', bundleName),
    version: process.env.NOD_DESKTOP_VERSION,
    source: process.env.NOD_RELEASE_SOURCE,
    commit: process.env.NOD_FLATPAK_COMMIT,
  });
}
