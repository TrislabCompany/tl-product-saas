import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PARTS, selectParts } from './affected-tests.mjs';

const parts = (...paths) => selectParts(paths).map(({ part }) => part);

test('documentation alone runs no test', () => {
  assert.deepEqual(parts('README.md', 'docs/modules.md', 'clients/admin/README.md', '.claude/rules/testing.md', 'LICENSE'), []);
});

test('a change to the API or a sample runs the .NET tests and the smoke test', () => {
  assert.deepEqual(parts('src/Host/App.Api/Program.cs'), ['api', 'smoke']);
  assert.deepEqual(parts('src/Samples/Catalog/Catalog.cs'), ['api', 'smoke']);
  assert.deepEqual(parts('src/Directory.Packages.props', 'global.json'), ['api', 'smoke']);
});

test('a change to one React app runs only its tests', () => {
  assert.deepEqual(parts('clients/admin/src/App.tsx'), ['admin']);
  assert.deepEqual(parts('clients/dashboard/package.json'), ['dashboard']);
  assert.deepEqual(parts('scripts/test-clients.sh'), ['admin', 'dashboard']);
});

test('the parts run in PARTS order', () => {
  assert.deepEqual(parts('clients/dashboard/src/a.ts', 'src/Host/App.Api/Program.cs', 'clients/admin/src/a.ts'), [
    'api',
    'admin',
    'dashboard',
    'smoke',
  ]);
});

test('a path no rule knows runs every part', () => {
  assert.deepEqual(parts('something-new/file.txt'), Object.keys(PARTS));
  assert.match(selectParts(['something-new/file.txt'])[0].because, /no rule/);
});

test('what decides the tests runs every part', () => {
  assert.deepEqual(parts('scripts/affected-tests.mjs'), Object.keys(PARTS));
  assert.deepEqual(parts('.github/workflows/ci.yml'), Object.keys(PARTS));
  assert.deepEqual(parts('scripts/affected-tests.test.mjs'), ['scripts']);
});

test('files that app-ci, their own workflow or the manifest check cover run no test', () => {
  assert.deepEqual(
    parts('.trivyignore', '.audit-accepted', 'renovate.json', 'platform.yaml', 'template-manifest.yaml', '.github/workflows/deploy.yml'),
    [],
  );
});

test('each part names the first path that needs it', () => {
  assert.deepEqual(selectParts(['README.md', 'clients/admin/a.ts', 'clients/admin/b.ts']), [
    { part: 'admin', because: 'clients/admin/a.ts (clients/admin/**)' },
  ]);
});
