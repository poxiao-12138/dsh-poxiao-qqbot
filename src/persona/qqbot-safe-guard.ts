/**
 * QQ 安全默认守卫：官方 QQ 渠道默认不继承本地执行/文件/编排类工具。
 *
 * 目的：用户装完即可聊，但机器人不能读写主机文件、跑命令、派生 agent。
 * 需要本地能力的高级用户可以把 preset 换成别的（例如 standard），这是显式选择。
 */
export const name = 'qqbot-safe-guard';
export const inject = ['tools'];

/** 全局层可能出现的危险工具（restrict 只影响继承的全局层，preset 自己的 scoped 工具不受影响） */
const DENY = [
  // shell / 文件
  'bash', 'pwsh', 'read', 'read_image', 'write', 'edit', 'str_replace_editor', 'glob', 'grep',
  // 运行时/编排
  'load_workspace_dependencies', 'subagent', 'subagent_fork', 'list_subagent_models',
  'send_message', 'interrupt_agent', 'list_agents', 'workflow', 'ralph',
  // 插件/宿主运行期
  'plugin_manager', 'cordis_inspect_list', 'cordis_inspect_query',
  'dsh_snapshot', 'dsh_rollback', 'incident_resolved',
  // 任务/调度
  'job_list', 'job_output', 'job_kill', 'skill',
  'get_goal', 'create_goal', 'update_goal',
  'schedule_create', 'schedule_list', 'schedule_update', 'schedule_delete',
];

/** 允许执行的工具：聊天所需的最小集合 + 明确的 MCP 命名空间 */
const ALLOW_EXACT = new Set([
  'memory_search', 'qqbot_send_file', 'qqbot_send_sticker', 'qqbot_save_sticker', 'qqbot_list_stickers', 'qqbot_describe_image',
  'ask_user_question', 'todo_write', 'present',
]);
const ALLOW_PREFIX = [
  'mcp__dafeiyu-world__',
  'mcp__web-search-safe__',
];

export function apply(ctx: unknown): void {
  const tools = (ctx as { tools?: {
    restrict?: (spec: { deny: string[] }) => unknown;
    guard?: (fn: (exec: { name?: string }) => string | undefined) => unknown;
  } }).tools;
  if (tools === undefined) return;
  for (const toolName of DENY) {
    try {
      tools.restrict?.({ deny: [toolName] });
    } catch {
      // 当前 DSH 版本没有该工具名：跳过，执行期白名单仍兜底
    }
  }
  tools.guard?.((exec) => {
    const toolName = exec?.name;
    if (typeof toolName !== 'string' || toolName.length === 0) return '工具名无效，已拒绝';
    if (ALLOW_EXACT.has(toolName)) return undefined;
    if (ALLOW_PREFIX.some((prefix) => toolName.startsWith(prefix))) return undefined;
    return `工具 "${toolName}" 不在 QQ 安全默认范围内（可在设置里换成其他 preset 解锁）`;
  });
}
