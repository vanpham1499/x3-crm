// Offline regression suite only. Database/VPS/browser acceptance is run separately.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const directories = [
  'apps/backend/integrations/zalo/web',
  'apps/backend/integrations/zalo/call',
  'apps/backend/integrations/zalo/file-import',
  'apps/backend/integrations/zalo/pc',
  'apps/backend/integrations/zalo/pc/tests',
  'apps/backend/integrations/zalo/shared',
  'apps/backend/integrations/zalo',
  'tooling/zalo-team',
  'tooling/zalo-team/call',
];
const files = directories.flatMap(directory => fs.readdirSync(path.join(repo, directory))
  .filter(name => /\.test\.(?:mjs|cjs)$/.test(name))
  .map(name => `${directory}/${name}`)).concat('tooling/tests/zalo-source-layout.test.cjs').sort();
if (process.argv.includes('--list')) {
  console.log(files.join('\n'));
} else {
  console.log(`Zalo: ${files.length} test files; no customer database, account or VPS required.`);
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
    cwd: repo, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
