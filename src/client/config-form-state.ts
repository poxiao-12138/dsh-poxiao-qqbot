/** Editable QQ settings and field-level draft reconciliation. */
export interface AccessControlWire {
  c2cMode: 'open' | 'allowlist' | 'disabled';
  c2cAllow: string[];
  commandMode?: 'open' | 'allowlist' | 'disabled';
  groupMode: 'open' | 'allowlist' | 'disabled';
  groupAllow: string[];
}

/** 渠道级语音设置（Breeze Key 不在此处，复用在 qq-voice-polish 设置页保存的凭证） */
export interface VoiceWire {
  voiceId?: string;
  enabled: boolean;
  mode: 'voiceOnly' | 'both' | 'text' | 'auto';
  autoDefault?: 'text' | 'voice';
  groupVoice: boolean;
  maxChars: number;
  fallbackText: boolean;
  instructions?: string;
  guidanceScale?: number;
  guidanceScaleEmotion?: number;
  fadeMs?: number;
  padMs?: number;
  sampleRate?: number;
  channels?: 1 | 2;
  autoPunctuation?: boolean;
  emotionMarkers?: boolean;
  polish?: boolean;
  polishPrompt?: string;
  retries?: number;
  outputFormat?: 'wav' | 'mp3';
}

/** 长期记忆（目前 Obsidian） */
export interface MemoryWire {
  enabled: boolean;
  backend: 'obsidian' | 'none';
  vaultPath: string;
  scope: string;
  topK: number;
  maxChars: number;
  verifiedOnly: boolean;
  promptRule: boolean;
  organizeEnabled?: boolean;
  organizeCommand?: string;
  organizeTimes?: string;
  idleMinutes?: number;
}

/** 表情包库 */
export interface StickerWire {
  autoCollect?: boolean;
  enabled: boolean;
  dir?: string;
}

/** Credential secrets are never included in the browser settings response. */
export interface ConfigWire {
  accessRevision?: string;
  appId?: string;
  requireMention?: boolean;
  streaming?: boolean;
  wakeBatchSeconds?: number;
  proactiveWakeEnabled?: boolean;
  showToolResults?: boolean;
  debug?: boolean;
  provider?: string;
  model?: string;
  preset?: string;
  groupPrompt?: string;
  directPrompt?: string;
  access?: AccessControlWire;
  voice?: VoiceWire;
  memory?: MemoryWire;
  stickers?: StickerWire;
  cwd?: string;
}

const EDITABLE_KEYS = ['access', 'requireMention', 'streaming', 'showToolResults', 'debug',
  'provider', 'model', 'preset', 'groupPrompt', 'directPrompt', 'wakeBatchSeconds', 'proactiveWakeEnabled', 'voice', 'memory', 'stickers'] as const;
const ACCESS_KEYS = ['c2cMode', 'c2cAllow', 'groupMode', 'groupAllow', 'commandMode'] as const;

export const DEFAULT_ACCESS: AccessControlWire = {
  c2cMode: 'allowlist', c2cAllow: [], groupMode: 'allowlist', groupAllow: [], commandMode: 'allowlist',
};

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Preserve raw textarea lines while editing; normalize only the submitted snapshot. */
export function normalizeConfig(form: ConfigWire): ConfigWire {
  if (form.access === undefined) return { ...form };
  const lines = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return {
    ...form,
    access: { ...form.access, c2cAllow: lines(form.access.c2cAllow), groupAllow: lines(form.access.groupAllow) },
  };
}

/** Build the writable difference without submitting account or working-directory fields. */
export function configPatch(baseline: ConfigWire, form: ConfigWire): Partial<ConfigWire> {
  const changed: Partial<ConfigWire> = {};
  for (const key of EDITABLE_KEYS) {
    if (!equal(form[key], baseline[key])) Object.assign(changed, { [key]: form[key] });
  }
  return changed;
}

export function isConfigDirty(baseline: ConfigWire, form: ConfigWire): boolean {
  return Object.keys(configPatch(baseline, form)).length > 0;
}

/** Refresh untouched fields while preserving local edits, including individual access fields. */
export function rebaseConfig(baseline: ConfigWire, form: ConfigWire, incoming: ConfigWire): ConfigWire {
  const rebased = { ...incoming };
  for (const key of EDITABLE_KEYS) {
    if (key !== 'access' && !equal(form[key], baseline[key])) Object.assign(rebased, { [key]: form[key] });
  }
  if (form.access !== undefined && !equal(form.access, baseline.access)) {
    const access = { ...(incoming.access ?? DEFAULT_ACCESS) };
    for (const key of ACCESS_KEYS) {
      if (!equal(form.access[key], baseline.access?.[key])) Object.assign(access, { [key]: form.access[key] });
    }
    rebased.access = access;
  }
  return rebased;
}

/** A saved draft contains only the settings edited by this tab, never credentials. */
export interface ConfigDraft {
  baseline: ConfigWire;
  form: ConfigWire;
}

/** Pick the supported fields so stored browser drafts cannot retain a future secret response field. */
export function configDraft(baseline: ConfigWire, form: ConfigWire): ConfigDraft {
  const pick = (source: ConfigWire): ConfigWire => {
    const value: ConfigWire = {};
    if (source.appId !== undefined) value.appId = source.appId;
    if (source.accessRevision !== undefined) value.accessRevision = source.accessRevision;
    for (const key of EDITABLE_KEYS) {
      if (source[key] !== undefined) Object.assign(value, { [key]: source[key] });
    }
    return value;
  };
  return { baseline: pick(baseline), form: pick(form) };
}

/** Ignore malformed tab storage instead of rendering unchecked field values. */
export function parseConfigDraft(value: unknown): ConfigDraft | undefined {
  const validConfig = (candidate: unknown): candidate is ConfigWire => {
    if (candidate === null || typeof candidate !== 'object') return false;
    const fields = candidate as Record<string, unknown>;
    for (const key of ['appId', 'accessRevision', 'provider', 'model', 'preset', 'groupPrompt', 'directPrompt']) {
      if (fields[key] !== undefined && typeof fields[key] !== 'string') return false;
    }
    for (const key of ['requireMention', 'streaming', 'showToolResults', 'debug', 'proactiveWakeEnabled']) {
      if (fields[key] !== undefined && typeof fields[key] !== 'boolean') return false;
    }
    if (fields.wakeBatchSeconds !== undefined && (typeof fields.wakeBatchSeconds !== 'number' || !Number.isInteger(fields.wakeBatchSeconds) || fields.wakeBatchSeconds < 0 || fields.wakeBatchSeconds > 30)) return false;
    if (fields.memory !== undefined) {
      if (fields.memory === null || typeof fields.memory !== 'object') return false;
      const memory = fields.memory as Record<string, unknown>;
      if (typeof memory.enabled !== 'boolean' || typeof memory.verifiedOnly !== 'boolean' || typeof memory.promptRule !== 'boolean') return false;
      if (!['obsidian', 'none'].includes(String(memory.backend))) return false;
      if (typeof memory.vaultPath !== 'string' || typeof memory.scope !== 'string') return false;
      for (const key of ['topK', 'maxChars', 'idleMinutes']) {
        if (typeof memory[key] !== 'number' || !Number.isFinite(memory[key] as number)) return false;
      }
      if (memory.organizeEnabled !== undefined && typeof memory.organizeEnabled !== 'boolean') return false;
      for (const key of ['organizeCommand', 'organizeTimes']) {
        if (memory[key] !== undefined && typeof memory[key] !== 'string') return false;
      }
    }
    if (fields.stickers !== undefined) {
      if (fields.stickers === null || typeof fields.stickers !== 'object') return false;
      const stickers = fields.stickers as Record<string, unknown>;
      if (typeof stickers.enabled !== 'boolean') return false;
      if (stickers.autoCollect !== undefined && typeof stickers.autoCollect !== 'boolean') return false;
      if (stickers.dir !== undefined && typeof stickers.dir !== 'string') return false;
    }
    if (fields.voice !== undefined) {
      if (fields.voice === null || typeof fields.voice !== 'object') return false;
      const voice = fields.voice as Record<string, unknown>;
      if (typeof voice.enabled !== 'boolean' || typeof voice.groupVoice !== 'boolean' || typeof voice.fallbackText !== 'boolean') return false;
      if (!['voiceOnly', 'both', 'text', 'auto'].includes(String(voice.mode))) return false;
      if (voice.autoDefault !== undefined && !['text', 'voice'].includes(String(voice.autoDefault))) return false;
      if (typeof voice.maxChars !== 'number' || !Number.isFinite(voice.maxChars)) return false;
      if (voice.instructions !== undefined && typeof voice.instructions !== 'string') return false;
      for (const key of ['guidanceScale', 'guidanceScaleEmotion', 'fadeMs', 'padMs', 'sampleRate', 'retries']) {
        if (voice[key] !== undefined && (typeof voice[key] !== 'number' || !Number.isFinite(voice[key] as number))) return false;
      }
      for (const key of ['autoPunctuation', 'emotionMarkers', 'polish']) {
        if (voice[key] !== undefined && typeof voice[key] !== 'boolean') return false;
      }
      if (voice.outputFormat !== undefined && !['wav', 'mp3'].includes(String(voice.outputFormat))) return false;
      if (voice.channels !== undefined && ![1, 2].includes(Number(voice.channels))) return false;
      if (voice.polishPrompt !== undefined && typeof voice.polishPrompt !== 'string') return false;
    }
    if (fields.access !== undefined) {
      if (fields.access === null || typeof fields.access !== 'object') return false;
      const access = fields.access as Record<string, unknown>;
      for (const key of ['c2cMode', 'groupMode']) {
        if (!['open', 'allowlist', 'disabled'].includes(String(access[key]))) return false;
      }
      if (access.commandMode !== undefined && (typeof access.commandMode !== 'string' || !['open', 'allowlist', 'disabled'].includes(access.commandMode))) return false;
      for (const key of ['c2cAllow', 'groupAllow']) {
        if (!Array.isArray(access[key]) || !access[key].every((entry: unknown) => typeof entry === 'string')) return false;
      }
    }
    return true;
  };
  if (value === null || typeof value !== 'object') return undefined;
  const stored = value as Record<string, unknown>;
  return validConfig(stored.baseline) && validConfig(stored.form)
    ? configDraft(stored.baseline, stored.form)
    : undefined;
}
