export const DEFAULT_WAKE_BATCH_SECONDS = 8;

/**
 * 端内绑定协议 —— 宿主路由与客户端面板的共享契约
 *
 * 类型与路径常量的唯一事实源：宿主（setup/bind-routes.ts）与浏览器
 * （client/bind-page.ts）各自 import，杜绝两端协议漂移。
 * 本模块必须保持纯类型 + 纯常量（零 node 依赖、零副作用）：
 * 客户端 tsdown 构建会将其内联进 bundle。
 */

/** 状态查询（绑定页轮询） */
export const BIND_STATE_PATH = '/qqbot/im-qqbot/bind';

/** 刷新二维码（绑定页按钮） */
export const BIND_REFRESH_PATH = '/qqbot/im-qqbot/bind/refresh';

/** 手动填写/编辑凭据（绑定页表单） */
export const BIND_MANUAL_PATH = '/qqbot/im-qqbot/bind/manual';

/** 解绑：移除已保存凭据，回到绑定流程 */
export const BIND_UNBIND_PATH = '/qqbot/im-qqbot/bind/unbind';

/** 配置读写（设置面板表单） */
export const BIND_CONFIG_PATH = '/qqbot/im-qqbot/config';

/** 人设：读写工作区 AGENTS.md（角色卡 + 行为规约） */
export const PERSONA_PATH = '/qqbot/im-qqbot/persona';

/** 内置情绪试听样音（mp3，免实时合成） */
export const VOICE_SAMPLE_PATH = '/qqbot/im-qqbot/voice-sample';

/** 音色试听（合成一小段并返回 wav） */
export const VOICE_PREVIEW_PATH = '/qqbot/im-qqbot/voice-preview';

/** Breeze 凭证（允许只改音色、不重贴 Key） */
export const VOICE_CREDENTIAL_PATH = '/qqbot/im-qqbot/voice-credential';

/** 记忆自动整理（立即跑一次/查看状态） */
export const ORGANIZE_PATH = '/qqbot/im-qqbot/organize';

/** 可用的 agent preset 列表（人设选择） */
export const PRESETS_PATH = '/qqbot/im-qqbot/presets';

/** 线上协议（HTTP 路由序列化形态） */
export type BindStateWire =
  | { phase: 'starting' }
  | { phase: 'waiting'; url: string; qrSvg?: string; issuedAt: number }
  | { phase: 'saving' }
  | { phase: 'failed'; reason: string }
  | { phase: 'bound'; appId: string };

/** manual / unbind 操作的统一响应 */
export interface BindActionResponse {
  ok: boolean;
  message?: string;
  error?: string;
}

export const RELEASE_CHECK_PATH = '/qqbot/im-qqbot/release-check';
