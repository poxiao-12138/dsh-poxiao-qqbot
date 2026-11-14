import type { MiddlewareContext } from '@tencent-connect/qqbot-nodejs';
/** Some SDK message branches keep optional author names only in the raw event. */
export declare function messageSenderName(message: Pick<MiddlewareContext['message'], 'senderName' | 'raw'>): string | undefined;
//# sourceMappingURL=message-sender-name.d.ts.map