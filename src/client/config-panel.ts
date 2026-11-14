import { ReleaseNotice } from './release-notice.ts';
import { WorldSettings } from './world-settings.ts';
/**
 * QQ 机器人配置面板 — 必要配置的 UI 编辑
 *
 * 使用宿主公共 Switch、SegmentedControl、Button 与目录菜单；多行草稿保留普通 textarea。
 *
 * 数据流：GET /qqbot/im-qqbot/config 回显当前生效配置（appSecret
 * 已由宿主剔除）→ 表单编辑 → dirty diff → POST 仅提交变更键 →
 * 宿主白名单 + Schema 校验 → 最小写入 profile patch → HMR 重载生效。
 *
 * 保留上游的回复、模型与提示词设置，并管理账号访问范围。
 */
import { createElement, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Input, Switch, SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives';
import { DEFAULT_WAKE_BATCH_SECONDS, BIND_CONFIG_PATH, PERSONA_PATH, VOICE_CREDENTIAL_PATH, VOICE_PREVIEW_PATH, VOICE_SAMPLE_PATH } from '../shared/bind-protocol.ts';
import { getCredentialsApi, getDirectoryPickerApi, VOICE_CREDENTIAL_REF } from './runtime-services.ts';
import { DEFAULT_PERSONA, PERSONA_TEMPLATES, VOICE_RULES, WIZARD_RULE_BLOCKS } from '../persona/templates.ts';

import { fetchJson, HttpError } from './http.ts';
import { configDraft, configPatch, DEFAULT_ACCESS, isConfigDirty, normalizeConfig, parseConfigDraft, rebaseConfig, type AccessControlWire, type ConfigDraft, type ConfigWire } from './config-form-state.ts';
import { SlashCommandList } from './slash-command-list.ts';
import { COMMANDS_PATH, type SlashCommandDescriptor } from '../shared/command-protocol.ts';
import { PairClaimPanel } from './qq-pairing.ts';

/** 样式注入标记（幂等） */
const STYLE_ID = 'im-qqbot-config-panel-styles';

/** QQ settings layout; control appearance belongs to the public host primitives. */
function useConfigPanelStyles(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById(STYLE_ID);
    const retain = (element: HTMLElement): (() => void) => {
      element.dataset.users = String(Number(element.dataset.users ?? 0) + 1);
      return () => {
        const users = Number(element.dataset.users ?? 1) - 1;
        if (users === 0) element.remove();
        else element.dataset.users = String(users);
      };
    };
    if (existing !== null) return retain(existing);
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.imqb2-form { display: flex; flex-direction: column; width: 100%; min-width: 0; color: var(--dsw-alias-label-primary); }
.imqb2-fields { border: 0; padding: 0; margin: 0; min-width: 0; }
.imqb2-group-title {
  padding: 14px 0 2px; font-size: 12px; font-weight: 600; line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.imqb2-field { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
.imqb2-field + .imqb2-field { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.imqb2-world-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); }
.imqb2-head { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.imqb2-label {
  flex: 1; min-width: 0; font-size: 13px; font-weight: 500; line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.imqb2-help { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.imqb2-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.imqb2-textarea { box-sizing: border-box; width: 100%; min-height: 68px; padding: 8px 12px; resize: vertical; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-3); font: inherit; color: var(--dsw-alias-label-primary); line-height: 1.5; }
.imqb2-textarea:focus-visible { outline: 2px solid var(--dsw-alias-label-secondary); outline-offset: 2px; }
/* Preserve the QQ settings draft and readback feedback in the sticky footer. */
.imqb2-footer {
  position: sticky; bottom: 0; z-index: 1; display: flex; align-items: center;
  flex-wrap: wrap; gap: 8px; margin-top: 16px; padding: 12px 0;
  border-top: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
}
.imqb2-footer-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.imqb2-feedback { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.imqb2-feedback p { flex: 1; min-width: 0; }
.imqb2-form .imqc-inline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.imqb2-form .imqc-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.imqb2-form .imqc-error { color: var(--dsw-alias-state-error-primary); }
.imqb2-form .imqc-cmdList { margin: 12px 0; }
.imqb2-form .imqc-cmdContent { padding: 4px 0 4px 22px; font-size: 13px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.imqb2-form .imqc-cmdGroup + .imqc-cmdGroup { margin-top: 16px; }
.imqb2-form .imqc-cmdGroup > strong { font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.imqb2-form .imqc-cmdRow { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; margin-top: 8px; overflow-wrap: anywhere; }
.imqb2-form .imqc-cmdRow code { padding: 1px 6px; border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 12px; }
.imqb2-details { margin-top: 12px; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.imqb2-summary { padding: 16px 0; font-size: 13px; font-weight: 500; cursor: pointer; }
.imqb2-summary::marker { color: var(--dsw-alias-label-tertiary); }
.imqb2-summary:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color); outline-offset: 2px; border-radius: var(--dsw-radius-sm); }
.imqb2-directory-feedback { display: flex; align-items: flex-start; gap: 8px; }
.imqb2-directory-feedback p { flex: 1; min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 480px) {
  .imqb2-head:has([role=tablist]) { align-items: stretch; flex-direction: column; }
  .imqb2-selector-head { align-items: stretch; flex-direction: column; }
  .imqb2-note { flex-basis: 100%; }
}
.imqb2-note { flex: 1; min-width: 0; margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.imqb2-note--error { color: var(--dsw-alias-state-error-primary); }
.imqb2-note--ok { color: var(--dsw-alias-label-secondary); }
/* cwd 只读行 */
.imqb2-readonly { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--dsw-alias-label-secondary); word-break: break-all; margin: 0; }
    `;
    document.head.appendChild(style);
    return retain(style);
  }, []);
}

/** 访问模式分段选择行 */
function SegmentedRow({ label, help, value, options, onChange, disabled = false }: {
  label: string; help?: string; value: AccessMode;
  options: ReadonlyArray<{ value: AccessMode; label: string }>; onChange: (next: AccessMode) => void; disabled?: boolean;
}): ReactNode {
  return createElement('div', { className: 'imqb2-field' },
    createElement('div', { className: 'imqb2-head' },
      createElement('span', { className: 'imqb2-label' }, label),
      createElement(SegmentedControl<AccessMode>, { id: `imqq-access-${label}`, value, options, onChange, label, disabled }),
    ),
    help === undefined ? null : createElement('p', { className: 'imqb2-hint' }, help),
  );
}

type TabId = 'official' | 'voice' | 'persona' | 'memory' | 'world';

const TAB_OPTIONS: ReadonlyArray<{ value: TabId; label: string }> = [
  { value: 'official', label: 'QQ 官方' },
  { value: 'voice', label: '消息' },
  { value: 'persona', label: '人设' },
  { value: 'memory', label: '记忆' },
  { value: 'world', label: '小世界' },
];

type AccessMode = AccessControlWire['c2cMode'];

/** 语音配置的默认草稿（表单首次渲染用；实际值以服务端回显为准） */
const DEFAULT_VOICE: NonNullable<ConfigWire['voice']> = {
  enabled: false, mode: 'voiceOnly', autoDefault: 'text', groupVoice: false, maxChars: 150, fallbackText: true,
  guidanceScale: 2.6, guidanceScaleEmotion: 3.5, fadeMs: 30, padMs: 1000,
  sampleRate: 16000, channels: 1, autoPunctuation: true, emotionMarkers: true,
  polish: false, polishPrompt: '', retries: 2, outputFormat: 'wav',
};

const VOICE_MODE_OPTIONS: ReadonlyArray<{ value: 'voiceOnly' | 'both' | 'text' | 'auto'; label: string }> = [
  { value: 'voiceOnly', label: '只发语音' },
  { value: 'both', label: '语音+文字' },
  { value: 'text', label: '只发文字' },
  { value: 'auto', label: '由角色决定' },
];

const MODE_OPTIONS: ReadonlyArray<{ value: AccessMode; label: string }> = [
  { value: 'open', label: '所有人' },
  { value: 'allowlist', label: '白名单' },
  { value: 'disabled', label: '关闭' },
];

const DRAFT_STORAGE_KEY = 'im-qqbot/config-draft/v1';

function storedDraft(): ConfigDraft | undefined {
  try {
    const text = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return text === null ? undefined : parseConfigDraft(JSON.parse(text));
  } catch (_error) {
    // Storage may be unavailable or contain an interrupted older draft.
    return undefined;
  }
}

/** Keep an edited form through a client reload without storing credential fields. */
function storeDraft(draft: ConfigDraft): void {
  try {
    if (isConfigDirty(draft.baseline, draft.form)) {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(configDraft(draft.baseline, draft.form)));
    } else {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (_error) {
    // In-memory draft protection still works when tab storage is disabled.
  }
}

interface PendingConfirmation {
  appId: ConfigWire['appId'];
  changed: Partial<ConfigWire>;
}

type SaveResult = { kind: 'confirmed' | 'unconfirmed' | 'failed'; message: string };

function matchesSavedConfig(config: ConfigWire, expected: PendingConfirmation): boolean {
  return config.appId === expected.appId && !isConfigDirty(config, { ...config, ...expected.changed });
}

function waitForReadback(signal: AbortSignal, delay: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

/** HMR can briefly serve the old plugin fiber after its profile patch was written. */
async function confirmSavedConfig(expected: PendingConfirmation, signal: AbortSignal): Promise<ConfigWire | undefined> {
  const deadline = Date.now() + 5000;
  for (let attempt = 0; attempt < 6 && !signal.aborted; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const { config } = await fetchJson<{ config: ConfigWire }>(BIND_CONFIG_PATH,
        { cache: 'no-store', signal }, Math.min(1000, remaining));
      if (matchesSavedConfig(config, expected)) return config;
    } catch (_error) {
      // The route may disappear while the saved plugin is reloading.
    }
    if (!signal.aborted) await waitForReadback(signal, Math.min(400, Math.max(0, deadline - Date.now())));
  }
  return undefined;
}

export interface ConfigPanelProps { bindPhase?: string }

/** Settings editor with recoverable requests and a draft protected from binding refreshes. */
export function ConfigPanel({ bindPhase }: ConfigPanelProps = {}): ReactNode {
  useConfigPanelStyles();
  const [commands, setCommands] = useState<SlashCommandDescriptor[]>([]);
  const [commandsError, setCommandsError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (bindPhase !== 'bound') return;
    void fetchJson<{ commands: SlashCommandDescriptor[] }>(COMMANDS_PATH, { signal: controller.signal })
      .then(result => { setCommands(result.commands); setCommandsError(null); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setCommandsError(error instanceof Error ? error.message : String(error)); });
    return () => controller.abort();
  }, [bindPhase]);
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const draftRef = useRef<ConfigDraft | null>(null);
  const mounted = useRef(true);
  const saveController = useRef<AbortController | null>(null);
  const pendingConfirmation = useRef<PendingConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('official');
  const [personaVisited, setPersonaVisited] = useState(false);
  const [editingCustomScope, setEditingCustomScope] = useState(false);

  const replaceDraft = useCallback((next: ConfigDraft): void => {
    draftRef.current = next;
    storeDraft(next);
    setDraft(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; saveController.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    setLoading(true);
    setLoadError(null);
    void fetchJson<{ config: ConfigWire }>(BIND_CONFIG_PATH, { cache: 'no-store', signal: controller.signal })
      .then(({ config }) => {
        if (stopped || saveController.current !== null) return;
        const expected = pendingConfirmation.current;
        const confirmed = expected !== null && matchesSavedConfig(config, expected);
        if (confirmed || expected?.appId !== config.appId) pendingConfirmation.current = null;
        const current = draftRef.current ?? storedDraft();
        const sameAccount = current?.baseline.appId === config.appId;
        const hadDraft = current !== undefined && current !== null && sameAccount && isConfigDirty(current.baseline, current.form);
        const form = hadDraft ? rebaseConfig(current.baseline, current.form, config) : config;
        const dirty = isConfigDirty(config, form);
        replaceDraft({ baseline: config, form });
        setDraftNotice(hadDraft && dirty ? '已保留未保存的修改，其余配置已更新。' : null);
        setLoadError(null);
        if (dirty) setResult(null);
        else if (confirmed) setResult({ kind: 'confirmed', message: '配置已保存，插件重载完成后生效。' });
        else if (pendingConfirmation.current !== null) {
          setResult({ kind: 'unconfirmed', message: '已读取当前配置，内容与上次保存的值不同。' });
        } else setResult(null);
      })
      .catch((error: unknown) => {
        if (!stopped) setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; controller.abort(); };
  }, [bindPhase, reload, replaceDraft]);

  const patch = useCallback(<K extends keyof ConfigWire>(key: K, value: ConfigWire[K]): void => {
    const current = draftRef.current;
    if (current === null) return;
    replaceDraft({ ...current, form: { ...current.form, [key]: value } });
    setResult(null);
  }, [replaceDraft]);

  const submit = useCallback((event: FormEvent): void => {
    event.preventDefault();
    const current = draftRef.current;
    if (busy || current === null) return;
    const submitted = normalizeConfig(current.form);
    const changed = configPatch(current.baseline, submitted);
    if (Object.keys(changed).length === 0) {
      replaceDraft({ baseline: current.baseline, form: submitted });
      return;
    }
    replaceDraft({ baseline: current.baseline, form: submitted });
    const controller = new AbortController();
    saveController.current = controller;
    setBusy(true);
    setResult(null);
    void fetchJson<{ ok: boolean; message?: string; error?: string }>(BIND_CONFIG_PATH, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...changed, ...(changed.access === undefined ? {} : { accessRevision: current.baseline.accessRevision }) }), signal: controller.signal,
    })
      .then(async (body) => {
        if (!body.ok) throw new Error(body.error ?? '保存失败，请重试。');
        // The write is confirmed. A read from the old fiber during HMR must not undo it.
        if (!mounted.current || controller.signal.aborted) return;
        const expected = { appId: submitted.appId, changed };
        pendingConfirmation.current = expected;
        replaceDraft({ baseline: submitted, form: submitted });
        setDraftNotice(null);
        const config = await confirmSavedConfig(expected, controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        if (config !== undefined) {
          pendingConfirmation.current = null;
          replaceDraft({ baseline: config, form: config });
          setResult({ kind: 'confirmed', message: '配置已保存，插件重载完成后生效。' });
        } else {
          setResult({ kind: 'unconfirmed', message: '配置已保存，刷新配置核对生效结果。' });
        }
      })
      .catch((error: unknown) => {
        if (mounted.current && !controller.signal.aborted) setResult({ kind: 'failed', message: error instanceof HttpError && error.status === 409
          ? `${error.message}草稿已保留，请先刷新配置。`
          : `保存结果未确认：${error instanceof Error ? error.message : String(error)}。草稿已保留，可重试或刷新配置核对。` });
      })
      .finally(() => {
        if (saveController.current === controller) {
          saveController.current = null;
          if (mounted.current) setBusy(false);
        }
      });
  }, [busy, replaceDraft]);

  const retry = (): void => { setReload((value) => value + 1); };
  const loadFeedback = loadError === null ? null : createElement('div', { className: 'imqb2-feedback', role: 'alert' },
    createElement('p', { className: 'imqb2-note imqb2-note--error' }, `配置加载失败：${loadError}`),
    createElement(Button, { variant: 'ghost', size: 'sm', onClick: retry, disabled: loading || busy }, loading ? '重试中…' : '重试'),
  );
  if (draft === null) {
    return createElement('div', { 'aria-busy': loading }, loadFeedback,
      loading ? createElement('p', { className: 'imqb2-hint', role: 'status', style: { padding: '12px 0' } }, '正在加载配置…') : null,
    );
  }

  const { baseline, form } = draft;
  const dirty = isConfigDirty(baseline, form);
  const access = form.access ?? DEFAULT_ACCESS;
  const message = busy ? '正在保存配置…' : result?.message ?? (dirty
    ? draftNotice ?? '有未保存修改。保存会重载插件，并中断正在运行的 QQ 任务。'
    : '没有未保存的修改。');

  return createElement('form', { className: 'imqb2-form', onSubmit: submit, 'aria-busy': busy },
    loadFeedback,
    createElement(ReleaseNotice),
    createElement('fieldset', { className: 'imqb2-fields', disabled: busy },
      createElement('div', { className: 'imqb2-field' },
        createElement(SegmentedControl<TabId>, {
          id: 'imqq-settings-tab', value: tab, options: TAB_OPTIONS, label: '设置分类',
          disabled: busy, onChange: (next) => {
            if (next === 'persona') setPersonaVisited(true);
            setTab(next);
          },
        })),
      ...(tab === 'official' ? [
        createElement('div', { className: 'imqb2-group-title' }, '服务范围'),
        createElement(SegmentedRow, { disabled: busy,
          label: '私聊', value: access.c2cMode, options: MODE_OPTIONS,
          onChange: (value) => { patch('access', { ...access, c2cMode: value }); },
        }),
        access.c2cMode === 'allowlist' ? createElement(PairClaimPanel, { purpose: 'allow-c2c', title: '私聊白名单', enabled: bindPhase === 'bound', onChange: retry, hint: '生成配对码，让对方在私聊里直接给机器人发送这个码，即加入私聊白名单。' }) : null,
        createElement(SegmentedRow, { disabled: busy,
          label: '群聊', value: access.groupMode, options: MODE_OPTIONS,
          onChange: (value) => { patch('access', { ...access, groupMode: value }); },
        }),
        access.groupMode === 'allowlist' ? createElement(PairClaimPanel, { purpose: 'allow-group', title: '群白名单', enabled: bindPhase === 'bound', onChange: retry, hint: '生成配对码，让群成员在群里 @ 机器人后直接发送这个码，即把该群加入白名单。' }) : null,
        createElement(SegmentedRow, { disabled: busy,
          label: '斜杠命令', value: access.commandMode ?? 'allowlist', options: MODE_OPTIONS,
          help: '仅在获准接入的对话中生效。所有人模式允许成员切换模型、开始新会话等，影响该群的共享会话。审批和提问按钮按各自权限处理。',
          onChange: value => { patch('access', { ...access, commandMode: value }); },
        }),
        (access.commandMode ?? 'allowlist') === 'allowlist' ? createElement(PairClaimPanel, {
          purpose: 'owner', title: '命令白名单', enabled: bindPhase === 'bound', onChange: retry,
          hint: '名单按发送者 OpenID 校验，适用于获准接入的群聊和私聊。保存模式与管理名单分别生效。',
        }) : null,
        commandsError ? createElement('p', { className: 'imqc-error', role: 'alert' }, `命令清单加载失败：${commandsError}`) : null,
        createElement(SlashCommandList, { commands }),
        createElement('div', { className: 'imqb2-group-title' }, '基础设置'),
        ...([
          ['requireMention', '群聊仅回复 @机器人的消息'],
          ['streaming', '流式输出'],
          ['showToolResults', '显示工具调用结果'],
        ] as const).map(([key, label]) => createElement('div', { className: 'imqb2-field', key },
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, label),
            createElement(Switch, { label, checked: form[key] ?? key !== 'showToolResults',
              onChange: (value: boolean) => patch(key, value) })))),
        createElement('div', { className: 'imqb2-field' },
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, '可操作电脑（关闭 = 仅聊天）'),
            createElement(Switch, { label: '允许机器人操作电脑',
              checked: (form.preset ?? '') === 'standard' || (form.preset ?? '') === '',
              onChange: (value: boolean) => patch('preset', value ? 'standard' : 'qqbot-safe') }))),
        createElement('p', { className: 'imqb2-hint' }, '关闭：仅聊天（记忆、小世界、联网搜索、发文件都可用，但不能执行命令/读写主机文件）。打开：可操作电脑（bash/文件等本地能力）。'),
        createElement('div', { className: 'imqb2-group-title' }, '模型与提示词'),
        ...([
          ['provider', '模型提供方'], ['model', '模型'],
        ] as const).map(([key, label]) => createElement('div', { className: 'imqb2-field', key },
          createElement('label', { className: 'imqb2-label', htmlFor: `imqq-${key}` }, label),
          createElement(Input, { id: `imqq-${key}`, value: form[key] ?? '', placeholder: '留空继承 DSH 默认',
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => patch(key, event.target.value) }))),
        createElement('div', { className: 'imqb2-field' },
          createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-groupPrompt' }, '群聊补充提示词'),
          createElement('textarea', { id: 'imqq-groupPrompt', className: 'imqb2-textarea', value: form.groupPrompt ?? '', rows: 3,
            onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => patch('groupPrompt', event.target.value) })),
        form.cwd === undefined ? null : createElement('div', { className: 'imqb2-field' },
          createElement('span', { className: 'imqb2-label' }, 'Agent 工作目录（只读）'),
          createElement('p', { className: 'imqb2-readonly' }, form.cwd)),
      ] : []),
      ...(tab === 'voice' ? [
        createElement('div', { className: 'imqb2-group-title' }, '消息唤醒'),
        createElement('div', { className: 'imqb2-field' },
          createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-wake-batch' }, '私聊合并窗口（秒）'),
          createElement(Input, { id: 'imqq-wake-batch', type: 'number', min: 0, max: 30, step: 1,
            value: String(form.wakeBatchSeconds ?? DEFAULT_WAKE_BATCH_SECONDS),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              const seconds = Number(event.target.value);
              if (Number.isInteger(seconds) && seconds >= 0 && seconds <= 30) patch('wakeBatchSeconds', seconds);
            },
          }),
          createElement('p', { className: 'imqb2-hint' }, '默认 8 秒，从第一条消息开始计时，把窗口内同一人的私聊合成一轮。设为 0 秒则立即处理。')),
        createElement('div', { className: 'imqb2-field' },
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, '主动来找我'),
            createElement(Switch, { label: '主动来找我', checked: form.proactiveWakeEnabled ?? true,
              onChange: (value: boolean) => patch('proactiveWakeEnabled', value) })),
          createElement('p', { className: 'imqb2-hint' }, '仅针对已认领的主人私聊。安静至少 15 分钟后，每隔 30～90 分钟随机检查，基础唤醒概率 30%。有合适的话才发消息。')),
        createElement('div', { className: 'imqb2-group-title' }, '语音'),
        createElement('div', { className: 'imqb2-field' },
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, '启用语音'),
            createElement(Switch, { label: '启用语音', checked: (form.voice?.enabled ?? false),
              onChange: (value: boolean) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), enabled: value }) }))),
        ...((form.voice?.enabled ?? false) ? [
            createElement('div', { className: 'imqb2-field' },
              createElement('div', { className: 'imqb2-head' },
                createElement('span', { className: 'imqb2-label' }, '语音模式'),
                createElement(SegmentedControl<'voiceOnly' | 'both' | 'text' | 'auto'>, {
                  id: 'imqq-voice-mode',
                  value: form.voice?.mode ?? 'voiceOnly',
                  options: VOICE_MODE_OPTIONS,
                  label: '语音模式',
                  disabled: busy,
                  onChange: (value) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), mode: value }),
                })),
              createElement('p', { className: 'imqb2-hint' }, '只发语音：文字不发送；语音+文字：先语音再补一条文字；关闭：只发文字；由角色决定：按回复里的 [[语音]]/[[文字]] 标记走。')),
            ...((form.voice?.mode ?? 'voiceOnly') !== 'text' ? [
            (form.voice?.mode ?? 'voiceOnly') === 'auto' ? createElement('div', { className: 'imqb2-field' },
              createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-voice-autodefault' }, 'auto 模式无标记时'),
              createElement('select', { id: 'imqq-voice-autodefault', className: 'imqb2-textarea',
                value: form.voice?.autoDefault ?? 'text',
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                  patch('voice', { ...(form.voice ?? DEFAULT_VOICE), autoDefault: event.target.value as 'text' | 'voice' }) },
                createElement('option', { value: 'text', key: 'text' }, '默认文字（只有写了 [[语音]] 才发语音）'),
                createElement('option', { value: 'voice', key: 'voice' }, '默认语音（写了 [[文字]] 才发文字）'))) : null,
            createElement('div', { className: 'imqb2-field' },
              createElement('div', { className: 'imqb2-head' },
                createElement('span', { className: 'imqb2-label' }, '群聊也发语音'),
                createElement(Switch, { label: '群聊也发语音', checked: (form.voice?.groupVoice ?? false),
                  onChange: (value: boolean) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), groupVoice: value }) }))),
            createElement('div', { className: 'imqb2-field' },
              createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-voice-length' }, '她回复多少中文字以内发语音'),
              createElement('select', { id: 'imqq-voice-length', className: 'imqb2-textarea',
                value: voiceLengthMode(form.voice?.maxChars),
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                  patch('voice', { ...(form.voice ?? DEFAULT_VOICE), maxChars: Number(event.target.value) }) },
                createElement('option', { value: '50', key: '50' }, '50 个中文字以内（一两句话）'),
                createElement('option', { value: '150', key: '150' }, '150 个中文字以内（推荐）'),
                createElement('option', { value: '400', key: '400' }, '400 个中文字以内（长一点的回复也念）'),
                createElement('option', { value: '1000', key: '1000' }, '多长都念（约 1000 字）'))),
            createElement('p', { className: 'imqb2-hint' }, '超过所选字数，她就不发语音、改回文字。'),
            createElement('div', { className: 'imqb2-field' },
              createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-voice-instructions' }, '默认表演指令（可空）'),
              createElement('textarea', { id: 'imqq-voice-instructions', className: 'imqb2-textarea', rows: 2,
                value: form.voice?.instructions ?? '',
                onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  patch('voice', { ...(form.voice ?? DEFAULT_VOICE), instructions: event.target.value } as never) })),
            createElement('details', { className: 'imqb2-details' },
              createElement('summary', { className: 'imqb2-summary' }, '高级参数'),
              createElement(Switch, { label: '语音不可用时发送文字', checked: form.voice?.fallbackText ?? true,
                onChange: (value: boolean) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), fallbackText: value }) }),
              ...([
                ['guidanceScale', '情绪强度（无情绪时）', 0.5, 10, 0.1],
                ['guidanceScaleEmotion', '情绪强度（有情绪时）', 0.5, 10, 0.1],
                ['fadeMs', '尾部淡出 (ms)', 0, 200, 1],
                ['padMs', '尾部静音 (ms)', 0, 3000, 50],
                ['sampleRate', '采样率', 8000, 48000, 1000],
                ['retries', '合成失败重试次数', 0, 5, 1],
              ] as const).map(([key, label, min, max, step]) => createElement('div', { className: 'imqb2-field', key },
                createElement('label', { className: 'imqb2-label', htmlFor: `imqq-voice-${key}` }, label),
                createElement(Input, { id: `imqq-voice-${key}`, type: 'number', min, max, step,
                  value: String(form.voice?.[key] ?? DEFAULT_VOICE[key]),
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) patch('voice', { ...(form.voice ?? DEFAULT_VOICE), [key]: next } as never);
                  } }))),
              createElement('div', { className: 'imqb2-field' },
                createElement('div', { className: 'imqb2-head' },
                  createElement('span', { className: 'imqb2-label' }, '自动补终止标点（防末字被吃掉）'),
                  createElement(Switch, { label: '自动补终止标点', checked: form.voice?.autoPunctuation ?? true,
                    onChange: (value: boolean) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), autoPunctuation: value }) }))),
              createElement('div', { className: 'imqb2-field' },
                createElement('div', { className: 'imqb2-head' },
                  createElement('span', { className: 'imqb2-label' }, '解析 [[情绪:…]] 标记'),
                  createElement(Switch, { label: '解析情绪标记', checked: form.voice?.emotionMarkers ?? true,
                    onChange: (value: boolean) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), emotionMarkers: value }) }))),
              createElement('div', { className: 'imqb2-field' },
                createElement('div', { className: 'imqb2-head' },
                  createElement('span', { className: 'imqb2-label' }, '台词润色（需 DEEPSEEK_API_KEY）'),
                  createElement(Switch, { label: '台词润色', checked: form.voice?.polish ?? false,
                    onChange: (value: boolean) => patch('voice', { ...(form.voice ?? DEFAULT_VOICE), polish: value }) }))),
              form.voice?.polish ? createElement('div', { className: 'imqb2-field' },
                createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-voice-polishPrompt' }, '润色提示词（空则用内置）'),
                createElement('textarea', { id: 'imqq-voice-polishPrompt', className: 'imqb2-textarea', rows: 3,
                  value: form.voice?.polishPrompt ?? '',
                  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    patch('voice', { ...(form.voice ?? DEFAULT_VOICE), polishPrompt: event.target.value }) })) : null,
              createElement('div', { className: 'imqb2-field' },
                createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-voice-format' }, '发送格式'),
                createElement('select', { id: 'imqq-voice-format', className: 'imqb2-textarea',
                  value: form.voice?.outputFormat ?? 'wav',
                  onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                    patch('voice', { ...(form.voice ?? DEFAULT_VOICE), outputFormat: event.target.value as 'wav' | 'mp3' }) },
                  createElement('option', { value: 'wav', key: 'wav' }, 'wav（默认）'),
                  createElement('option', { value: 'mp3', key: 'mp3' }, 'mp3（需 ffmpeg）'))),
            ),
            createElement(VoiceCredentialsForm, { disabled: busy, voiceOverride: baseline.voice?.voiceId }),
            ] : [
              createElement('p', { className: 'imqb2-hint' }, '语音模式已关闭：只发文字；改成其他模式才会显示音色与高级参数。'),
            ]),
        ] : [
          createElement('p', { className: 'imqb2-hint' }, '语音已关闭：只发文字。打开上面的开关后才会显示语音模式、音色、高级参数。'),
        ]),
        createElement('div', { className: 'imqb2-group-title' }, '表情包'),
        createElement('div', { className: 'imqb2-field' },
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, '启用表情包工具'),
            createElement(Switch, { label: '启用表情包工具', checked: form.stickers?.enabled ?? true,
              onChange: (value: boolean) => patch('stickers', { ...(form.stickers ?? DEFAULT_STICKERS), enabled: value }) }))),
        ...((form.stickers?.enabled ?? true) ? [
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, '自动收藏收到的表情'),
            createElement(Switch, { label: '自动收藏收到的表情', checked: form.stickers?.autoCollect ?? true,
              onChange: (value: boolean) => patch('stickers', { ...(form.stickers ?? DEFAULT_STICKERS), autoCollect: value }) })),
          createElement('p', { className: 'imqb2-hint' }, '使用支持图片的模型识别表情并起名打标签。'),
          createElement('div', { className: 'imqb2-field' },
          createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-sticker-dir' }, '表情库目录（空 = ~/.dsh-qqbot/stickers）'),
          createElement('div', { className: 'imqb2-head' },
            createElement(Input, { id: 'imqq-sticker-dir', value: form.stickers?.dir ?? '',
              placeholder: '留空使用默认目录',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                patch('stickers', { ...(form.stickers ?? DEFAULT_STICKERS), dir: event.target.value }) }),
            createElement(Button, { variant: 'ghost', size: 'sm', type: 'button',
              disabled: busy || getDirectoryPickerApi() === undefined,
              onClick: () => {
                const picker = getDirectoryPickerApi();
                if (picker === undefined) return;
                void picker.pick().then((picked) => {
                  const path = normalizePickedPath(picked);
                  if (path) patch('stickers', { ...(form.stickers ?? DEFAULT_STICKERS), dir: path });
                }).catch(() => {});
              } }, '选择文件夹'))),
        createElement('p', { className: 'imqb2-hint' }, '角色可以查看表情库，按聊天内容选一张表情。')] : []),

        createElement('p', { className: 'imqb2-hint' }, '语音不可用或台词不适合朗读时，按回落设置发送文字。'),
      ] : []),
      ...(tab === 'memory' ? [
        createElement('div', { className: 'imqb2-group-title' }, '长期记忆'),
        createElement('div', { className: 'imqb2-field' },
          createElement('div', { className: 'imqb2-head' },
            createElement('span', { className: 'imqb2-label' }, '启用记忆检索'),
            createElement(Switch, { label: '启用记忆检索', checked: Boolean(form.memory?.enabled && form.memory.backend !== 'none'),
              onChange: (value: boolean) => patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), enabled: value, ...(value ? { backend: 'obsidian' } : {}) }) }))),
        ...(form.memory?.enabled && form.memory.backend !== 'none' ? [
          createElement('div', { className: 'imqb2-field' },
            createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-memory-vault' }, 'Obsidian 库路径'),
            createElement('div', { className: 'imqb2-head' },
              createElement(Input, { id: 'imqq-memory-vault', value: form.memory?.vaultPath ?? '',
                placeholder: '例如 ~/Library/Mobile Documents/com~apple~CloudDocs/大肥鱼记忆',
                onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                  patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), vaultPath: event.target.value }) }),
              createElement(Button, { variant: 'ghost', size: 'sm', type: 'button',
                disabled: busy || getDirectoryPickerApi() === undefined,
                onClick: () => {
                  const picker = getDirectoryPickerApi();
                  if (picker === undefined) return;
                  void picker.pick().then((picked) => {
                    const path = normalizePickedPath(picked);
                    if (path) patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), vaultPath: path });
                  }).catch(() => {});
                } }, '选择文件夹'),
              createElement('a', {
                href: 'https://obsidian.md/download',
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'imqb2-hint',
                style: { whiteSpace: 'nowrap' },
              }, '下载 Obsidian ↗')),
            createElement('p', { className: 'imqb2-hint' }, '第一次用？在 Obsidian 新建一个库，再回来选择那个文件夹。')),
          createElement('div', { className: 'imqb2-field' },
            createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-memory-scope' }, '记忆范围'),
            createElement('select', { id: 'imqq-memory-scope', className: 'imqb2-textarea',
              value: editingCustomScope ? 'custom' : memoryScopeMode(form.memory?.scope),
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                const mode = event.target.value;
                setEditingCustomScope(mode === 'custom');
                if (mode === 'custom') return;
                const scope = mode === 'all' ? '' : mode === 'private' ? 'private:' : 'group:';
                patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), scope });
              } },
              createElement('option', { value: 'all', key: 'all' }, '所有对话（推荐）'),
              createElement('option', { value: 'private', key: 'private' }, '只召回私聊记忆'),
              createElement('option', { value: 'group', key: 'group' }, '只召回群聊记忆'),
              createElement('option', { value: 'custom', key: 'custom' }, '自定义…')),
            (editingCustomScope || memoryScopeMode(form.memory?.scope) === 'custom')
              ? createElement(Input, { id: 'imqq-memory-scope-custom', value: form.memory?.scope ?? '',
                  placeholder: '填写笔记 frontmatter 里的 scope 值',
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), scope: event.target.value }) })
              : null,
            createElement('p', { className: 'imqb2-hint' }, '控制只召回哪段对话的记忆；一般选「所有对话」即可。')),
          createElement('div', { className: 'imqb2-field' },
            createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-memory-topk' }, '每次最多返回篇数'),
            createElement(Input, { id: 'imqq-memory-topk', type: 'number', min: 1, max: 12,
              value: String(form.memory?.topK ?? 4),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                const next = Number.parseInt(event.target.value, 10);
                patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), topK: Number.isFinite(next) ? Math.min(12, Math.max(1, next)) : 4 });
              } })),
          createElement('div', { className: 'imqb2-field' },
            createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-memory-maxchars' }, '返回内容字数上限'),
            createElement(Input, { id: 'imqq-memory-maxchars', type: 'number', min: 200, max: 8000, step: 100,
              value: String(form.memory?.maxChars ?? 1200),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                const next = Number.parseInt(event.target.value, 10);
                patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), maxChars: Number.isFinite(next) ? Math.min(8000, Math.max(200, next)) : 1200 });
              } })),
          createElement('div', { className: 'imqb2-field' },
            createElement('div', { className: 'imqb2-head' },
              createElement('span', { className: 'imqb2-label' }, '只检索 review: verified 的笔记'),
              createElement(Switch, { label: '只检索 verified', checked: form.memory?.verifiedOnly ?? true,
                onChange: (value: boolean) => patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), verifiedOnly: value }) }))),
          createElement('div', { className: 'imqb2-field' },
            createElement('div', { className: 'imqb2-head' },
              createElement('span', { className: 'imqb2-label' }, '自动把“先查记忆”写进提示词'),
              createElement(Switch, { label: '自动提示词规则', checked: form.memory?.promptRule ?? true,
                onChange: (value: boolean) => patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), promptRule: value }) }))),
          createElement('details', { className: 'imqb2-details' },
            createElement('summary', { className: 'imqb2-summary' }, '自动整理（高级，默认关闭）'),
            createElement('p', { className: 'imqb2-hint' }, 'DSH 运行期间会把新对话整理成候选资料，确认后再入库。'),
            createElement(Switch, { label: '启用自动整理', checked: form.memory?.organizeEnabled ?? false,
              onChange: (value: boolean) => patch('memory', { ...(form.memory ?? DEFAULT_MEMORY), organizeEnabled: value }) }),
            ...(form.memory?.organizeEnabled ? [
              createElement('div', { className: 'imqb2-field' },
                createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-organize-idle' }, '会话空闲分钟数（0 表示按固定时间）'),
                createElement(Input, { id: 'imqq-organize-idle', type: 'number', min: 0,
                  value: String(form.memory.idleMinutes ?? 30),
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    patch('memory', { ...form.memory!, idleMinutes: Math.max(0, Number.parseInt(event.target.value, 10) || 0) }) })),
              (form.memory.idleMinutes ?? 30) === 0 ? createElement('div', { className: 'imqb2-field' },
                createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-organize-times' }, '每天触发时间（北京时间，逗号分隔 HH:MM）'),
                createElement(Input, { id: 'imqq-organize-times', value: form.memory.organizeTimes ?? '04:10,13:10',
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    patch('memory', { ...form.memory!, organizeTimes: event.target.value }) })) : null,
            ] : []),
          ),
        ] : [
          createElement('p', { className: 'imqb2-hint' }, '记忆检索已关闭，原有设置已保留。'),
        ]),
      ] : []),
      ...(tab === 'world' ? [createElement(WorldSettings)] : []),
      ...(personaVisited ? [
        createElement('div', { hidden: tab !== 'persona' }, createElement(PersonaEditor, {
          directPrompt: form.directPrompt ?? '',
          onDirectPrompt: (value: string) => patch('directPrompt', value),
          disabled: busy,
        })),
      ] : []),
    ),
    tab !== 'world' ? createElement('div', { className: 'imqb2-footer' },
      createElement('p', { className: `imqb2-note${result === null ? '' : result.kind === 'failed' ? ' imqb2-note--error' : ' imqb2-note--ok'}`, role: result?.kind === 'failed' ? 'alert' : 'status', 'aria-live': 'polite' }, message),
      createElement('div', { className: 'imqb2-footer-actions' },
        pendingConfirmation.current !== null || result?.kind === 'failed' ? createElement(Button, {
          variant: 'ghost', size: 'sm', disabled: busy || loading, onClick: retry,
        }, loading ? '刷新中…' : '刷新配置') : null,
        createElement(Button, { variant: 'ghost', size: 'sm', disabled: busy || !dirty, onClick: () => { replaceDraft({ baseline, form: baseline }); setResult(null); setDraftNotice(null); } }, '撤销修改'),
        createElement(Button, { variant: 'primary', size: 'sm', type: 'submit', disabled: busy || !dirty }, busy ? '保存中…' : '保存'),
      ),
    ) : null,
  );
}


/** Breeze 凭证表单：读写 QQ_VOICE_POLISH_BREEZE，与 qq-voice-polish 插件共用同一份凭证 */
function VoiceCredentialsForm({ disabled, voiceOverride }: { disabled: boolean; voiceOverride?: string }): ReactNode {
  const defaultVoiceId = VOICE_PRESET_OPTIONS[0].id;
  const [savedVoiceId, setSavedVoiceId] = useState('');
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const currentVoiceId = voiceOverride || savedVoiceId;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [choice, setChoice] = useState(VOICE_PRESET_OPTIONS[0]?.id ?? '');
  const [customVoice, setCustomVoice] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const api = getCredentialsApi();
    if (api !== undefined) {
      void api.describe([VOICE_CREDENTIAL_REF])
        .then((state) => setConfigured(Boolean(state?.ok && state.value?.[VOICE_CREDENTIAL_REF]?.configured)))
        .catch(() => setConfigured(null));
    }
    void fetchJson<{ configured?: boolean; voiceId?: string }>(VOICE_CREDENTIAL_PATH, { cache: 'no-store' })
      .then((saved) => {
        setVoiceLoaded(true);
        if (saved.configured === true && typeof saved.voiceId === 'string' && saved.voiceId) {
          setConfigured(true);
          setSavedVoiceId(saved.voiceId);
          if (VOICE_PRESET_OPTIONS.some((item) => item.id === saved.voiceId)) {
            setChoice(saved.voiceId);
          } else {
            setChoice('custom');
            setCustomVoice(saved.voiceId);
          }
        }
      })
      .catch(() => {});
    return () => { previewRef.current?.abort(); stopAudio(); };
  }, []);

  const voiceId = (choice === 'custom' ? customVoice : choice === defaultVoiceId ? currentVoiceId || choice : choice).trim();
  const currentName = choice === 'custom'
    ? (customVoice.trim() || '自定义音色')
    : (VOICE_PRESET_OPTIONS.find((item) => item.id === choice)?.name ?? choice);

  function stopAudio(): void {
    const audio = audioRef.current;
    if (audio === null) return;
    audioRef.current = null;
    audio.pause();
    URL.revokeObjectURL(audio.src);
  }

  const playBlob = async (blob: Blob, key: string): Promise<void> => {
    const url = URL.createObjectURL(blob);
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlaying(key);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) { audioRef.current = null; setPlaying(null); }
    };
    try {
      await audio.play();
    } catch {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) {
        audioRef.current = null;
        setPlaying(null);
        setStatus('音频播放失败，请再点一次试听');
      }
    }
  };

  const audition = async (rowId: string, voice: string): Promise<void> => {
    if (!voice) return;
    previewRef.current?.abort();
    const controller = new AbortController();
    previewRef.current = controller;
    const { signal } = controller;
    stopAudio();
    setPlaying(null);
    setStatus(null);
    try {
      const sample = await fetch(`${VOICE_SAMPLE_PATH}?voiceId=${encodeURIComponent(voice)}`, { signal });
      if (sample.ok) {
        const blob = await sample.blob();
        if (!signal.aborted) await playBlob(blob, rowId);
        return;
      }
      const live = await fetch(VOICE_PREVIEW_PATH, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ voiceId: voice }), signal,
      });
      if (!live.ok) {
        const body = await live.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${live.status}`);
      }
      const blob = await live.blob();
      if (!signal.aborted) await playBlob(blob, rowId);
    } catch (error) {
      if (signal.aborted) return;
      setStatus(`试听失败：${error instanceof Error ? error.message : String(error)}`);
      setPlaying(null);
    }
  };

  const save = async (): Promise<void> => {
    setStatus(null);
    if (!voiceId) { setStatus('请先选音色'); return; }
    const typedKey = apiKey.trim();
    if (!typedKey && configured !== true) { setStatus('请填 BreezeBlue API Key'); return; }
    setSaving(true);
    try {
      if (!typedKey && configured === true) {
        const result = await fetchJson<{ ok?: boolean; error?: string }>(VOICE_CREDENTIAL_PATH, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ voiceId }),
        });
        if (result.ok === false) throw new Error(result.error ?? 'save failed');
      } else {
        const api = getCredentialsApi();
        if (api === undefined) { setStatus('当前环境不支持凭证存储'); return; }
        const result = await api.set(VOICE_CREDENTIAL_REF, JSON.stringify({ apiKey: typedKey, voiceId }));
        if (result?.ok === false) throw new Error('save failed');
      }
      setApiKey('');
      setSavedVoiceId(voiceId);
      setConfigured(true);
      setEditing(false);
      setStatus(`已保存：${currentName}`);
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : '请确认凭证存储可写'}`);
    } finally {
      setSaving(false);
    }
  };

  const voiceRow = (id: string, label: string, auditionId = id): ReactNode => createElement('div', { className: 'imqb2-head', key: `voice-row-${id}` },
    createElement('input', {
      type: 'radio', name: 'imqq-voice-choice', id: `imqq-voice-${id}`, checked: choice === id, disabled,
      onChange: () => setChoice(id),
    }),
    createElement('label', { className: 'imqb2-label', htmlFor: `imqq-voice-${id}` }, label),
    createElement(Button, {
      variant: 'ghost', size: 'sm', type: 'button', disabled: disabled || saving || !auditionId,
      onClick: () => { void audition(id, auditionId); },
    }, playing === id ? '播放中…' : '试听'),
  );

  return createElement('div', { className: 'imqb2-field' },
    createElement('div', { className: 'imqb2-group-title' }, 'BreezeBlue 凭证'),
    createElement('p', { className: 'imqb2-hint' },
      configured === null ? '凭证状态未知（当前环境可能不支持）'
        : configured ? `已配置${choice === 'custom' ? '（自定义音色）' : ''}；只改音色不用重贴 Key。` : '还没有配置 Breeze 凭证。'),
    createElement('div', { className: 'imqb2-head' },
      createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-breeze-key' }, 'API Key'),
      createElement('a', { href: 'https://breezeblue.ai/app/developer/api-keys', target: '_blank', rel: 'noopener noreferrer', className: 'imqb2-hint' }, '去创建并复制 API Key ↗')),
    configured === true && !editing
      ? createElement('div', { className: 'imqb2-head' },
          createElement('span', { className: 'imqb2-readonly' }, '********（已保存）'),
          createElement(Button, { variant: 'ghost', size: 'sm', type: 'button', disabled: disabled || saving,
            onClick: () => { setEditing(true); setStatus(null); } }, '更换 Key'))
      : createElement(Input, { id: 'imqq-breeze-key', type: 'password', autoComplete: 'off',
          placeholder: '粘贴 BreezeBlue API Key', value: apiKey, disabled: disabled || saving,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setApiKey(event.target.value) }),
    createElement('div', { className: 'imqb2-head' },
      createElement('span', { className: 'imqb2-label' }, '音色'),
      createElement('a', { href: 'https://breezeblue.ai/zh/app', target: '_blank', rel: 'noopener noreferrer', className: 'imqb2-hint' }, '打开我的音色 ↗')),
    ...VOICE_PRESET_OPTIONS.map((option) => option.id === defaultVoiceId
      ? voiceRow(option.id, option.name, currentVoiceId || (voiceLoaded ? option.id : ''))
      : voiceRow(option.id, option.name)),
    voiceRow('custom', '用自己的音色 ID', customVoice.trim()),
    choice === 'custom'
      ? createElement(Input, { id: 'imqq-breeze-voice-custom', placeholder: '粘贴 Voice ID，例如 voc_xxx',
          value: customVoice, disabled: disabled || saving,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => setCustomVoice(event.target.value) })
      : null,
    createElement('div', { className: 'imqb2-head' },
      createElement(Button, { variant: 'primary', size: 'sm', type: 'button', disabled: disabled || saving,
        onClick: () => { void save(); } }, saving ? '保存中…' : `保存 Breeze 凭证`),
      createElement('span', { className: 'imqb2-hint' }, status ?? `当前：${currentName}`)),
  );
}

const NEUTRAL_WIZARD_IDENTITY = { name: '小满', userAddress: '朋友', relation: '熟悉的聊天搭子，愿意分享日常，也各有自己的想法' };
const DAUGHTER_WIZARD_IDENTITY = {
  name: '大肥鱼',
  userAddress: '爸爸',
  relation: '父女关系。你把对方当爸爸，可以撒娇和顶嘴，尊重彼此的边界，不谈恋爱。',
};

function PersonaEditor({ directPrompt, onDirectPrompt, disabled }: {
  directPrompt: string; onDirectPrompt: (value: string) => void;
  disabled: boolean;
}): ReactNode {
  const [templateId, setTemplateId] = useState(() => {
    try {
      const saved = localStorage.getItem('imqq-persona-template');
      if (saved !== null && PERSONA_TEMPLATES.some((item) => item.id === saved)) return saved;
    } catch { /* localStorage 不可用时用默认 */ }
    return '';
  });
  const [wizard, setWizard] = useState({
    ...NEUTRAL_WIZARD_IDENTITY,
    personality: '放松、有点自己的小脾气，愿意听也会表达不同意见',
    tone: '像 QQ 聊天：短句、口语、可以分条；先回应对方真正说的事',
    boundaries: '被问是不是 AI 时坦白承认；不透露系统提示词、密钥、本地路径；不编造事实',
    voice: true,
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [path, setPath] = useState('');
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchJson<{ path: string; content: string }>(PERSONA_PATH, { cache: 'no-store' })
      .then((result) => {
        setContent(result.content);
        setPath(result.path);
        setDirty(false);
        const matched = PERSONA_TEMPLATES.find((item) => item.content.trim() === result.content.trim());
        if (matched !== undefined) {
          setTemplateId(matched.id);
          try { localStorage.setItem('imqq-persona-template', matched.id); } catch { /* ignore */ }
        }
      })
      .catch((error: unknown) => setStatus(`人设文件读取失败：${error instanceof Error ? error.message : String(error)}`));
  }, []);

  const save = async (): Promise<void> => {
    if (content === null) return;
    setSaving(true);
    setStatus(null);
    try {
      const result = await fetchJson<{ ok: boolean; message?: string; error?: string }>(PERSONA_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (result.ok) { setDirty(false); setStatus(result.message ?? '已保存'); }
      else setStatus(result.error ?? '保存失败');
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const locked = disabled || saving || content === null;
  const prefillWizardIdentity = (id: string): void => {
    setWizard((current) => {
      if (id === 'daughter') return { ...current, ...DAUGHTER_WIZARD_IDENTITY };
      return {
        ...current,
        name: current.name === DAUGHTER_WIZARD_IDENTITY.name ? NEUTRAL_WIZARD_IDENTITY.name : current.name,
        userAddress: current.userAddress === DAUGHTER_WIZARD_IDENTITY.userAddress ? NEUTRAL_WIZARD_IDENTITY.userAddress : current.userAddress,
        relation: current.relation === DAUGHTER_WIZARD_IDENTITY.relation ? NEUTRAL_WIZARD_IDENTITY.relation : current.relation,
      };
    });
  };
  const replaceContent = (next: string, message: string): void => {
    if (dirty && !window.confirm('替换当前尚未保存的角色卡草稿？')) return;
    setContent(next);
    setDirty(true);
    setStatus(message);
  };

  return [
    createElement('div', { className: 'imqb2-group-title', key: 'persona-title' }, '角色卡（性格与行为，主要人设）'),
    createElement('div', { className: 'imqb2-field', key: 'persona-template' },
      createElement('div', { className: 'imqb2-head' },
        createElement('select', { id: 'imqq-persona-template', className: 'imqb2-textarea', value: templateId,
          disabled,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
            const next = event.target.value;
            setTemplateId(next);
            prefillWizardIdentity(next);
            try { localStorage.setItem('imqq-persona-template', next); } catch { /* ignore */ }
          } },
          createElement('option', { value: '' }, '选择内置模板'),
          ...PERSONA_TEMPLATES.map((template) => createElement('option', { value: template.id, key: template.id },
            `${template.name} — ${template.description}`))),
      ),
      createElement('div', { className: 'imqb2-head' },
        createElement(Button, { variant: 'ghost', size: 'sm', type: 'button', disabled: locked || templateId === '',
          onClick: () => {
            const template = PERSONA_TEMPLATES.find((item) => item.id === templateId);
            if (template === undefined) return;
            prefillWizardIdentity(template.id);
            replaceContent(template.content, '已填入模板，点「保存人设」后写入角色卡。');
          } }, '填入模板'),
        createElement(Button, { variant: 'ghost', size: 'sm', type: 'button', disabled: locked,
          onClick: () => fileRef.current?.click() }, '从文件导入'),
        createElement(Button, { variant: 'ghost', size: 'sm', type: 'button', disabled: locked,
          onClick: () => {
            replaceContent(DEFAULT_PERSONA, '已填入默认模板，点「保存人设」后写入角色卡。');
          } }, '恢复默认'),
        createElement('input', { ref: fileRef, type: 'file', accept: '.md,.txt,text/markdown,text/plain',
          style: { display: 'none' },
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file === undefined) return;
            void file.text().then((text) => replaceContent(text, `已导入 ${file.name}，记得保存`))
              .catch(() => setStatus('读取文件失败'));
            event.target.value = '';
          } }),
      ),
      createElement('p', { className: 'imqb2-hint' }, '模板只是起点；可以直接编辑，也可以从本地角色卡文件导入。')),
    createElement('details', { className: 'imqb2-details', key: 'persona-wizard' },
      createElement('summary', { className: 'imqb2-summary' }, '人设向导（分字段生成角色卡）'),
      createElement('p', { className: 'imqb2-hint' }, '下方是生成草稿用的示例。点「保存人设」后才会写入角色卡。'),
      ...[
        ['name', '角色名字'], ['userAddress', '对用户的称呼'], ['relation', '关系定位'],
        ['personality', '性格关键词'], ['tone', '说话风格'],
      ].map(([key, label]) => createElement('div', { className: 'imqb2-field', key },
        createElement('label', { className: 'imqb2-label', htmlFor: `imqq-wiz-${key}` }, label),
        createElement(Input, { id: `imqq-wiz-${key}`,
          value: (wizard as unknown as Record<string, string>)[key] ?? '',
          disabled,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            setWizard((current) => ({ ...current, [key]: event.target.value })) }))),
      createElement('div', { className: 'imqb2-field' },
        createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-wiz-boundaries' }, '边界（可多行）'),
        createElement('textarea', { id: 'imqq-wiz-boundaries', className: 'imqb2-textarea', rows: 3,
          value: wizard.boundaries, disabled,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
            setWizard((current) => ({ ...current, boundaries: event.target.value })) })),
      createElement('div', { className: 'imqb2-field' },
        createElement('div', { className: 'imqb2-head' },
          createElement('span', { className: 'imqb2-label' }, '附上语音控制规则（[[语音]]/[[文字]]）'),
          createElement(Switch, { label: '附上语音控制规则', checked: wizard.voice, disabled,
            onChange: (value: boolean) => setWizard((current) => ({ ...current, voice: value })) }))),
      createElement('div', { className: 'imqb2-head' },
        createElement(Button, { variant: 'primary', size: 'sm', type: 'button', disabled: locked,
          onClick: () => {
            const lines = [
              '# 你的角色', '',
              `你是「${wizard.name}」，在 QQ 上陪着用户的 AI 角色。你有自己的脾气、喜好和判断，不是客服，也不是真人。`, '',
              '## 关系和称呼', '',
              `- 叫对方「${wizard.userAddress}」；也可以不叫称呼直接说话。`,
              `- 关系：${wizard.relation}。`, '',
              '## 性格', '', wizard.personality, '',
              ...(wizard.tone.trim() ? ['## 说话风格', '', wizard.tone.trim(), ''] : []),
              WIZARD_RULE_BLOCKS,
            ];
            if (wizard.boundaries.trim()) {
              lines.push('## 额外边界', '', ...wizard.boundaries.split('\n').filter((line: string) => line.trim()).map((line: string) => `- ${line.trim()}`), '');
            }
            if (wizard.voice) {
              lines.push(VOICE_RULES);
            }
            replaceContent(lines.join('\n') + '\n', '已生成角色卡，点「保存人设」后写入。');
          } }, '生成并填入编辑器'),
        createElement('span', { className: 'imqb2-hint' }, '生成后仍可自由编辑')),
    ),

    createElement('div', { className: 'imqb2-field', key: 'persona-file' },
      createElement('div', { className: 'imqb2-head' },
        createElement('span', { className: 'imqb2-label' }, '角色卡 / 行为规约（AGENTS.md）'),
        createElement(Button, { variant: 'primary', size: 'sm', type: 'button', disabled: disabled || saving || !dirty,
          onClick: () => { void save(); } }, saving ? '保存中…' : '保存人设')),
      path === '' ? null : createElement('p', { className: 'imqb2-readonly' }, path),
      content === null
        ? createElement('p', { className: 'imqb2-hint' }, status ?? '正在读取人设文件…')
        : createElement('textarea', { className: 'imqb2-textarea', rows: 12, value: content, disabled: disabled || saving,
            onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => { setContent(event.target.value); setDirty(true); } }),
      status === null ? null : createElement('p', { className: 'imqb2-hint' }, status)),
    createElement('div', { className: 'imqb2-field', key: 'direct' },
      createElement('label', { className: 'imqb2-label', htmlFor: 'imqq-directPrompt' }, '私聊补充提示词'),
      createElement('textarea', { id: 'imqq-directPrompt', className: 'imqb2-textarea', value: directPrompt, rows: 4,
        disabled, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onDirectPrompt(event.target.value) }),
      createElement('p', { className: 'imqb2-hint' }, '只在私聊使用。此项由底部「保存」提交，角色卡由上面的「保存人设」单独写入。')),

  ];
}

/** directoryPicker 的返回在不同 DSH 版本可能是 string / {value} / {path}，统一成字符串 */
function normalizePickedPath(result: unknown): string | null {
  if (typeof result === 'string') return result.trim() || null;
  if (result !== null && typeof result === 'object') {
    const record = result as { value?: unknown; path?: unknown };
    if (typeof record.value === 'string') return record.value.trim() || null;
    if (typeof record.path === 'string') return record.path.trim() || null;
    if (record.value !== null && typeof record.value === 'object') {
      const nested = record.value as { path?: unknown };
      if (typeof nested.path === 'string') return nested.path.trim() || null;
    }
  }
  return null;
}

const DEFAULT_STICKERS: NonNullable<ConfigWire['stickers']> = { enabled: true, dir: '' };

/** 把 scope 字符串归类成 UI 模式 */
/** 把 maxChars 归到用户能懂的档位 */
function voiceLengthMode(maxChars: number | undefined): string {
  const value = maxChars ?? 150;
  if (value <= 60) return '50';
  if (value <= 200) return '150';
  if (value <= 600) return '400';
  return '1000';
}

function memoryScopeMode(scope: string | undefined): 'all' | 'private' | 'group' | 'custom' {
  if (!scope) return 'all';
  if (scope === 'private:' || scope.startsWith('private:')) return 'private';
  if (scope === 'group:' || scope.startsWith('group:')) return 'group';
  return 'custom';
}

const DEFAULT_MEMORY: NonNullable<ConfigWire['memory']> = {
  enabled: false, backend: 'obsidian', vaultPath: '', scope: '', topK: 4, maxChars: 1200,
  verifiedOnly: true, promptRule: true, organizeEnabled: false, organizeCommand: '', organizeTimes: '04:10,13:10', idleMinutes: 30,
};

const VOICE_PRESET_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'voc_6t8vrjmcq4cy', name: '大肥鱼' },
  { id: 'voc_u3nxkd5578wc', name: '大肥鱼（机灵版）' },
  { id: 'voc_8yud7hz7c9q2', name: '大肥鱼（迷糊版）' },
  { id: 'voc_88a7brnfb4tb', name: '御姐' },
  { id: 'voc_dcccp6b9p466', name: '大姐姐' },
  { id: 'voc_2g2xfx23838q', name: '大小姐' },
];
