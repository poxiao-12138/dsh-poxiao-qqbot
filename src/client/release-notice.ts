import { createElement, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';

import { RELEASE_CHECK_PATH } from '../shared/bind-protocol.ts';

interface AvailableRelease { version: string; installed: string; address: string }

export function ReleaseNotice(): ReactNode {
  const [update, setUpdate] = useState<AvailableRelease>();
  const [copyStatus, setCopyStatus] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let active = true;

    async function check(): Promise<void> {
      const response = await fetch(RELEASE_CHECK_PATH, { signal: controller.signal });
      if (!response.ok) throw new Error('版本检查失败');
      const { update } = await response.json() as { update: AvailableRelease | null };
      if (active && update) setUpdate(update);
    }

    void check().catch(() => { if (active) setFailed(true); }).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!update) return failed
    ? createElement('p', { className: 'imqb2-hint', role: 'status' }, '暂时无法检查破晓 QQ 更新。')
    : null;

  const { address, version, installed } = update;
  return createElement('div', { className: 'imqb2-field' },
    createElement('div', { className: 'imqb2-head' },
      createElement('span', { className: 'imqb2-label', role: 'status' }, `发现新版 ${version}（当前 ${installed}）`),
      createElement(Button, {
        type: 'button', size: 'sm', variant: 'ghost',
        onClick: () => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(address);
              setCopyStatus('已复制。请在 DSH「添加插件」中粘贴安装地址。');
            } catch {
              setCopyStatus('无法自动复制。可以复制下方链接地址。');
            }
          })();
        },
      }, '复制安装地址')),
    createElement('p', { className: 'imqb2-hint', role: 'status' }, copyStatus,
      copyStatus.startsWith('无法') ? createElement('a', { href: address, target: '_blank', rel: 'noopener noreferrer' }, ' 下载新版') : null));
}
