/**
 * 客户端运行时服务句柄（宿主通过 inject 注入 remote.credentials）。
 * 用于在设置页里读写 Breeze 凭证，与 qq-voice-polish 共用
 * QQ_VOICE_POLISH_BREEZE 这一份安全凭证。
 */
export interface CredentialsApi {
  describe(refs: string[]): Promise<{
    ok?: boolean;
    value?: Record<string, { configured?: boolean } | undefined>;
  }>;
  set(ref: string, value: string): Promise<{ ok?: boolean }>;
  unset?(ref: string): Promise<{ ok?: boolean }>;
}

let credentialsApi: CredentialsApi | undefined;

export function setCredentialsApi(api: CredentialsApi | undefined): void {
  credentialsApi = api;
}

export function getCredentialsApi(): CredentialsApi | undefined {
  return credentialsApi;
}

export interface DirectoryPickerApi {
  pick(): Promise<string | null>;
}

let directoryPickerApi: DirectoryPickerApi | undefined;

export function setDirectoryPickerApi(api: DirectoryPickerApi | undefined): void {
  directoryPickerApi = api;
}

export function getDirectoryPickerApi(): DirectoryPickerApi | undefined {
  return directoryPickerApi;
}

export const VOICE_CREDENTIAL_REF = 'QQ_VOICE_POLISH_BREEZE';
