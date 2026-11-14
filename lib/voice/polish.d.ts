export interface PolishResult {
    text: string;
    instructions: string;
}
export declare function polishLine(text: string, instructions: string, customPrompt: string, timeoutMs?: number, instructionsOnly?: boolean): Promise<PolishResult | null>;
//# sourceMappingURL=polish.d.ts.map