export interface VoiceCredentials {
    apiKey: string;
    voiceId: string;
}
export declare function readDeepSeekKey(dshHome?: string): string | null;
export declare function saveVoiceCredentials(credentials: VoiceCredentials, dshHome?: string): boolean;
export declare function readVoiceCredentials(dshHome?: string): VoiceCredentials | null;
//# sourceMappingURL=credentials.d.ts.map