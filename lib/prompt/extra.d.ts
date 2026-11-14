/**
 * 补充提示词（按场景分离）：promptGroup / promptDirect。由调用方每步现读 settings，即时生效。
 */
export declare const EXTRA_SECTION_NAME = "qqbot:extra";
export declare const EXTRA_ORDER = 460;
export declare const EXTRA_MAX_CHARS = 80000;
export interface ScopePrompts {
    group?: string;
    direct?: string;
}
/** 取当次场景的补充提示词；长度已在设置写入时校验，注入时保留完整内容。 */
export declare function selectExtraPrompt(prompts: ScopePrompts, scope: import('./scope.ts').QQScope): string;
//# sourceMappingURL=extra.d.ts.map