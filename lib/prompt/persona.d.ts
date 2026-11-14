/**
 * 人设 role-card：markdown 文本，标题可用 `〔群聊〕` / `〔私聊〕` 标记归属某场景；
 * 无标记的小节两种场景都注入；注入前剥离标记，模型只见干净标题。
 *
 * 与 scope.ts 分工：scope 是"社交规则"，persona 是"你是谁/性格/语气"。
 */
import type { QQScope } from './scope.ts';
export declare const PERSONA_SECTION_NAME = "qqbot:persona";
export declare const PERSONA_ORDER = 440;
type SectionMode = 'all' | QQScope;
export interface RoleSection {
    mode: SectionMode;
    heading: string | null;
    lines: string[];
}
/** 按 markdown 标题把人设卡拆成小节，并识别场景标记。 */
export declare function parsePersonaSections(card: string): RoleSection[];
/** 取某场景真正要注入的人设文本（剥标记、压空行）。 */
export declare function selectPersonaText(card: string, scope: QQScope): string;
/** 供 UI 预览：每个小节在该场景下是否注入。 */
export declare function roleSectionReport(card: string, scope: QQScope): Array<{
    heading: string;
    mode: SectionMode;
    injected: boolean;
    chars: number;
}>;
export {};
//# sourceMappingURL=persona.d.ts.map