import { createElement as h, useEffect, useState, type ReactNode } from 'react';
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import { getCredentialsApi } from './runtime-services.ts';
import { WORLD_CREDENTIAL_REF, parseWorldConnection } from '../world/connection.ts';

export function WorldSettings(): ReactNode {
  const [connectionJson, setConnectionJson] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [editor, setEditor] = useState<'connection' | 'remove' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const api = getCredentialsApi();

  useEffect(() => {
    let active = true;
    void api?.describe([WORLD_CREDENTIAL_REF]).then((result) => {
      if (active && result.ok) setConfigured(result.value?.[WORLD_CREDENTIAL_REF]?.configured === true);
    }).catch(() => {});
    return () => { active = false; };
  }, [api]);

  function close(): void {
    if (saving) return;
    setEditor(null);
    setConnectionJson('');
    setError('');
  }

  async function save(): Promise<void> {
    if (!api || saving || !editor) return;
    setSaving(true);
    setError('');
    try {
      const result = editor === 'remove'
        ? await api.unset?.(WORLD_CREDENTIAL_REF)
        : await api.set(WORLD_CREDENTIAL_REF, JSON.stringify(parseWorldConnection(connectionJson)));
      if (!result?.ok) throw new Error('操作失败，请重试。');
      setConfigured(editor !== 'remove');
      setConnectionJson('');
      setEditor(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally {
      setSaving(false);
    }
  }

  const removing = editor === 'remove';
  const status = !api ? '当前界面不支持管理凭据' : configured === null ? '连接状态未知' : configured ? '已配置' : '未配置';

  return h('section', { className: 'imqb2-field', 'aria-label': '小世界连接' },
    h('div', { className: 'imqb2-group-title' }, '服务器'),
    h('div', { className: 'imqb2-world-row' },
      h('div', { className: 'imqb2-label' }, '大肥鱼的小世界',
        h('p', { className: 'imqb2-hint', role: 'status' }, status)),
      h(Button, { type: 'button', size: 'sm', variant: configured ? 'ghost' : 'primary', disabled: !api,
        onClick: () => setEditor('connection') }, configured ? '设置' : '添加连接'),
    ),
    h(Modal, {
      open: editor !== null, onClose: close, closeLabel: '关闭',
      title: removing ? '清除小世界连接' : '配置小世界连接',
      description: removing ? '清除后，QQ 私聊将无法通过此连接访问小世界。' : '粘贴从大肥鱼游戏复制的 MCP 连接 JSON。',
      footer: h('div', { className: 'imqb2-footer-actions' },
        configured && api?.unset && !removing ? h(Button, { type: 'button', variant: 'ghost', disabled: saving,
          onClick: () => { setError(''); setEditor('remove'); } }, '清除连接') : null,
        h(Button, { type: 'button', variant: 'ghost', disabled: saving, onClick: close }, '取消'),
        h(Button, { type: 'button', variant: 'primary', disabled: saving || (!removing && !connectionJson.trim()),
          onClick: () => { void save(); } }, saving ? '处理中…' : removing ? '确认清除' : '保存连接')),
    },
    !removing ? h('textarea', {
      className: 'imqb2-textarea', rows: 5, 'aria-label': 'MCP 连接 JSON',
      value: connectionJson, disabled: saving, autoComplete: 'off', spellCheck: false,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setConnectionJson(event.target.value),
    }) : null,
    error ? h('p', { className: 'imqb2-note imqb2-note--error', role: 'alert' }, error) : null),
  );
}
