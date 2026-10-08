export const DEFAULT_JWT_SECRET: string;
export function sign(payload: Record<string, unknown>, secret?: string): string;
export function stackKeys(secret?: string): { anon: string; service: string };
