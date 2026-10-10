import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { readAsarEntry } from '../../apps/backend/integrations/zalo/shared/asar.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const local = path.join(root, '.local');
const source = path.join(process.env.LOCALAPPDATA, 'Programs/Zalo/Zalo-26.9.10');
const archive = path.join(source, 'resources/app.asar');
const expected = '927aaaabaaac16fcb280c538f375cd822bc6deb81319c5d65a5c3e29e6abac09';
if (process.platform !== 'win32') throw Error('WINDOWS_REQUIRED');
if (createHash('sha256').update(readAsarEntry(archive, 'main-dist/main.js')).digest('hex') !== expected) throw Error('PC_VERSION_UNSUPPORTED');
await fs.mkdir(local, { recursive: true });
const install = path.join(local, 'pc-26.9.10');
if (!await fs.stat(path.join(install, 'resources/vendor.asar')).catch(() => null)) {
  await fs.cp(source, install, { recursive: true });
  await fs.rename(path.join(install, 'resources/app.asar'), path.join(install, 'resources/vendor.asar'));
  if (await fs.stat(path.join(install, 'resources/app.asar.unpacked')).catch(() => null))
    await fs.rename(path.join(install, 'resources/app.asar.unpacked'), path.join(install, 'resources/vendor.asar.unpacked'));
}
const app = path.join(install, 'resources/app');
await fs.mkdir(app, { recursive: true });
await fs.writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'ZaloTeamPc', version: '26.9.10', main: 'entry.cjs' }));
await fs.writeFile(path.join(app, 'entry.cjs'), `require(${JSON.stringify(path.resolve(root, '../../apps/backend/integrations/zalo/pc-bootstrap.cjs'))});`);
const configFile = path.join(local, 'connector.json');
if (!await fs.stat(configFile).catch(() => null)) await fs.writeFile(configFile, JSON.stringify({
  version: 1, port: 9248, token: randomBytes(32).toString('hex'),
  install, profile: path.join(local, 'profiles/account-1'),
}));
console.log(JSON.stringify({ prepared: true, version: '26.9.10', install, profile: path.join(local, 'profiles/account-1') }));
