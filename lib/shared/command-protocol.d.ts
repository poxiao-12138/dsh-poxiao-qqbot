/** Command catalog endpoint retained for existing QQ settings clients. */
export declare const COMMANDS_PATH = "/qqbot/im-qqbot/conversations";
export interface SlashCommandDescriptor {
    name: string;
    aliases: string[];
    description: string;
    category: 'agent' | 'qqbot';
    scope: 'owner' | 'all' | 'disabled';
    hidden?: boolean;
}
//# sourceMappingURL=command-protocol.d.ts.map