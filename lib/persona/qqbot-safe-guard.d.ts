/**
 * QQ 安全默认守卫：官方 QQ 渠道默认不继承本地执行/文件/编排类工具。
 *
 * 目的：用户装完即可聊，但机器人不能读写主机文件、跑命令、派生 agent。
 * 需要本地能力的高级用户可以把 preset 换成别的（例如 standard），这是显式选择。
 */
export declare const name = "qqbot-safe-guard";
export declare const inject: string[];
export declare function apply(ctx: unknown): void;
//# sourceMappingURL=qqbot-safe-guard.d.ts.map