import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'releases');
const version = process.argv[2];
const releaseName = 'dsh-poxiao-qqbot';
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('用法：npm run pack:release -- 0.2.3');
}

execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
  cwd: root,
  stdio: 'inherit',
});
mkdirSync(output, { recursive: true });
const staging = mkdtempSync(join(output, '.pack-'));
try {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const localName = manifest.name;
  const repository = 'https://gitee.com/poxiao12138/dsh-poxiao-qqbot';
  for (const entry of manifest.files) {
    const path = entry.replace(/\/\*\*$/, '');
    cpSync(join(root, path), join(staging, path), { recursive: true });
  }
  Object.assign(manifest, {
    name: releaseName,
    version,
    description: '破晓 · QQ 角色助手',
    repository: { type: 'git', url: `git+${repository}.git` },
    homepage: repository,
    bugs: { url: `${repository}/issues` },
  });
  writeFileSync(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build:client'], {
    cwd: root,
    env: {
      ...process.env,
      DSH_QQBOT_RELEASE_NAME: releaseName,
      DSH_QQBOT_CLIENT_OUT_DIR: join(staging, 'lib'),
    },
    stdio: 'inherit',
  });
  const client = readFileSync(join(staging, 'lib/client.js'), 'utf8');
  const registration = /^window\.__ModuleLoader__\.load\(\{\s*id:\s*("(?:[^"\\]|\\.)*"),/.exec(client);
  if (!registration || JSON.parse(registration[1]) !== manifest.name) {
    throw new Error(`客户端模块 ID 与发布包名 ${manifest.name} 不一致`);
  }
  for (const file of ['cordis.patch.yml', 'README.集成版.md']) {
    const path = join(staging, file);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(localName, releaseName));
  }
  execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--pack-destination', output], {
    cwd: staging, stdio: 'inherit',
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
} finally {
  rmSync(staging, { recursive: true, force: true });
}
