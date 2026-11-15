import type { ImQQBotConfig } from '../config.ts';
import type { Logger } from '../types.ts';
export declare function evolutionPrompt(config: ImQQBotConfig): string;
export declare function isExplicitEvolutionRequest(text: string): boolean;
export declare class PersonaEvolution {
    private readonly config;
    private readonly logger;
    private readonly allowed;
    private readonly idle;
    private readonly pending;
    private readonly lifetime;
    private readonly timer?;
    private running;
    constructor(config: ImQQBotConfig, logger: Logger, allowed: (peer: string) => boolean, idle: (peer: string) => boolean);
    private log;
    add(peer: string, text: string): void;
    stop(): void;
    private tick;
    private memoryContext;
    private infer;
}
//# sourceMappingURL=evolution.d.ts.map