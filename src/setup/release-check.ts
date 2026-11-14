import { readFileSync } from 'node:fs';

const gitee = 'https://gitee.com/poxiao12138/dsh-poxiao-qqbot';
const giteeApi = 'https://gitee.com/api/v5/repos/poxiao12138/dsh-poxiao-qqbot';

export interface AvailableRelease {
  installed: string;
  version: string;
  address: string;
}

function versionParts(version: string): number[] | undefined {
  const parts = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)?.slice(1).map(Number);
  return parts?.every(Number.isSafeInteger) ? parts : undefined;
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return 0;
  return (a[0]! - b[0]!) || (a[1]! - b[1]!) || (a[2]! - b[2]!);
}

export async function checkRelease(
  manifest: { version: string; poxiaoUpdates?: { channel: 'gitee' | 'github'; repository?: string } } =
    JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')),
  request: typeof fetch = fetch,
): Promise<AvailableRelease | null> {
  const installed = manifest.version;
  const source = manifest.poxiaoUpdates;
  const signal = AbortSignal.timeout(6500);
  const get = (url: string, method = 'GET') => request(url, {
    method, signal, headers: { Accept: 'application/json', 'User-Agent': 'dsh-poxiao-qqbot' },
  });

  if (source?.channel === 'github') {
    const slug = source.repository;
    if (!slug || !/^[\w-]+\/[\w.-]+$/.test(slug)) throw new Error('Invalid GitHub repository');
    const response = await get(`https://api.github.com/repos/${slug}/releases/latest`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Release unavailable');
    const release = await response.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
    if (compareVersions(release.tag_name, installed) <= 0) return null;
    const version = release.tag_name.replace(/^v/, '');
    const filename = `dsh-poxiao-qqbot-${version}.tgz`;
    const address = `https://github.com/${slug}/releases/download/${release.tag_name}/${filename}`;
    return release.assets.some((asset) => asset.name === filename && asset.browser_download_url === address)
      ? { installed, version, address } : null;
  }

  const response = await get(`${giteeApi}/tags?per_page=50`);
  if (!response.ok) throw new Error('Tags unavailable');
  const tags = await response.json() as { name: string }[];
  const tag = tags.map(({ name }) => name).filter((name) => /^v/.test(name) && compareVersions(name, installed) > 0)
    .sort((left, right) => compareVersions(right, left))[0];
  if (!tag) return null;
  const version = tag.slice(1);
  const asset = `releases/dsh-poxiao-qqbot-${version}.tgz`;
  const check = await get(`${giteeApi}/contents/${asset}?ref=${tag}`);
  if (check.status === 404) return null;
  if (!check.ok) throw new Error('Package unavailable');
  await check.body?.cancel();
  return { installed, version, address: `${gitee}/raw/${tag}/${asset}` };
}
