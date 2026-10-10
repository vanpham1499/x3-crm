const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');
const repo = path.resolve(__dirname, '../..');
const integration = path.join(repo, 'apps/backend/integrations/zalo');
function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(e =>
    e.name === 'node_modules' ? [] : e.isDirectory() ? files(path.join(root, e.name)) : [path.join(root, e.name)]);
}
test('backend Zalo modules resolve within backend, without runtime imports from tooling', () => {
  for (const file of files(integration).filter(f => /\.(mjs|cjs)$/.test(f) && !/\.test\./.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?:from\s*|import\s*\(|require\s*\()(['"])(\.[^'"\r\n]+)\1/g)) {
      const target = path.resolve(path.dirname(file), match[2]);
      assert.ok(target.startsWith(integration + path.sep), `${file}: outside integration ${match[2]}`);
      assert.ok(fs.existsSync(target), `${file}: missing ${match[2]}`);
    }
  }
});
test('Compose builds read backend source using Dockerfiles kept in tooling', () => {
  for (const [name, service] of [['web/compose.yml','connector'],['service/compose.yml','connector'],['service/compose.call.yml','call'],['service/compose.call-vps.yml','call']]) {
    const file=path.join(repo, 'tooling/zalo-team', name);
    const compose=yaml.parse(fs.readFileSync(file,'utf8'));
    const build=compose.services[service].build;
    const context=path.resolve(path.dirname(file), build.context);
    assert.equal(context, repo);
    const dockerfile=path.resolve(context, build.dockerfile);
    assert.ok(fs.existsSync(dockerfile));
    const text=fs.readFileSync(dockerfile,'utf8');
    assert.ok(text.includes('COPY apps/backend/integrations/zalo/'));
    for(const line of text.split(/\r?\n/).filter(line=>line.startsWith('COPY ') && !line.includes('--from='))) {
      const sources=line.trim().split(/\s+/).slice(1,-1).filter(s=>!s.startsWith('--'));
      for(const source of sources) {
        const absolute=path.resolve(context,source);
        if(source.includes('*')) {
          const expression=new RegExp('^'+path.basename(source).replaceAll('.','\\.').replaceAll('*','.*')+'$');
          assert.ok(fs.readdirSync(path.dirname(absolute)).some(n=>expression.test(n)), `Missing Docker COPY: ${source}`);
        } else assert.ok(fs.existsSync(absolute), `Missing Docker COPY: ${source}`);
      }
    }
  }
});
test('PHP subprocess entrypoints belong to backend and still exist', () => {
  for(const name of ['ZaloTeamFileImport','ZaloTeamPcSession']) {
    const source=fs.readFileSync(path.join(repo, `apps/backend/app/Services/${name}.php`),'utf8');
    assert.doesNotMatch(source, /base_path\('[^']*tooling\/zalo-team\/(?:file-import|pc)/);
    for(const match of source.matchAll(/base_path\('(integrations\/zalo\/[^']+)'\)/g))
      assert.ok(fs.existsSync(path.join(repo,'apps/backend',match[1])), `Missing PHP entrypoint: ${match[1]}`);
  }
});

test('host metrics service resolves to backend runtime with its offline tests', () => {
  const unit = fs.readFileSync(path.join(repo, 'tooling/zalo-team/service/x3-zalo-metrics.service'), 'utf8');
  const entry = unit.match(/^ExecStart=\/usr\/bin\/python3 \/opt\/x3-zalo-team\/(.+)$/m)?.[1]?.trim();
  assert.ok(entry?.startsWith('apps/backend/integrations/zalo/metrics/'));
  assert.ok(fs.existsSync(path.join(repo, entry)), `Missing metrics entrypoint: ${entry}`);
  assert.ok(fs.existsSync(path.join(repo, path.dirname(entry), 'server-metrics-test.py')));
});
