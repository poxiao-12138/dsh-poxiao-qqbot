export const WORLD_CREDENTIAL_REF = 'QQBOT_SMALL_WORLD';
export function worldEndpoint(value) {
    const url = new URL(value.trim());
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!(url.protocol === 'https:' || (local && url.protocol === 'http:'))
        || url.pathname !== '/mcp' || url.username || url.password || url.search || url.hash) {
        throw new Error('请填写以 /mcp 结尾的 HTTPS 地址。本机可使用 HTTP。');
    }
    return url;
}
export function parseWorldConnection(input) {
    let value;
    try {
        value = JSON.parse(input);
    }
    catch {
        throw new Error('JSON 格式有误，请完整复制小世界连接配置。');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('请粘贴小世界连接的 JSON 对象。');
    }
    const config = value;
    const headers = config.headers;
    const authorization = headers && typeof headers === 'object' && !Array.isArray(headers)
        ? Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
        : undefined;
    const address = config.url ?? config.endpoint;
    const token = typeof authorization === 'string'
        ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())?.[1]
        : authorization === undefined && typeof config.accessToken === 'string' ? config.accessToken.trim() : undefined;
    if (typeof address !== 'string' || !address.trim())
        throw new Error('连接配置缺少 MCP 服务地址。');
    if (!token || /\s/.test(token))
        throw new Error('连接配置缺少有效的访问令牌。');
    return { enabled: true, endpoint: worldEndpoint(address).href, token };
}
//# sourceMappingURL=connection.js.map