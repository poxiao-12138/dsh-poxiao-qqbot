/** A dedicated data root isolates preferences and media between Host instances. */
export declare function resolvePluginHome(dataDir: string | undefined, userHome: string): string;
/** 默认保持已有数据路径；隔离实例通过 QQBOT_DATA_DIR 指定独立目录。 */
export declare const PLUGIN_HOME: string;
/**
 * agent 工作目录：显式配置优先（空串视为未配置），缺省 PLUGIN_HOME/workspace。
 *
 * session 创建、路径白名单（send-file 工具与交付物投递）共用此解析，
 * 保证「agent 在哪写文件」与「白名单允许哪个目录」不漂移。
 */
export declare function resolveAgentCwd(cwdConfig: string | undefined): string;
//# sourceMappingURL=dirs.d.ts.map