import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export class RequestValidationError extends Error {}

export async function readSmallJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new RequestValidationError("request-too-large");

  const reader = request.body?.getReader();
  if (!reader) throw new RequestValidationError("missing-body");

  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new RequestValidationError("request-too-large");
    }
    chunks.push(value);
  }

  try {
    const body = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid-json-object");
    return body as Record<string, unknown>;
  } catch {
    throw new RequestValidationError("invalid-json");
  }
}

export function isSameOriginPost(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function isLoopbackCallback(candidate: unknown): candidate is string {
  if (typeof candidate !== "string" || candidate.length > 128) return false;
  try {
    const url = new URL(candidate);
    const port = Number(url.port);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" &&
      Number.isInteger(port) && port >= 1024 && port <= 65535 &&
      url.pathname === "/callback" && !url.username && !url.password && !url.search && !url.hash &&
      candidate === `http://127.0.0.1:${port}/callback`;
  } catch {
    return false;
  }
}

export function isState(candidate: unknown): candidate is string {
  return typeof candidate === "string" && /^[A-Za-z0-9_-]{43}$/.test(candidate);
}

export function isCodeChallenge(candidate: unknown): candidate is string {
  return typeof candidate === "string" && /^[A-Za-z0-9_-]{43}$/.test(candidate);
}

export function isCodeVerifier(candidate: unknown): candidate is string {
  return typeof candidate === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(candidate);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashIpAddress(address: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) throw new Error("Supabase server key is not configured.");
  return createHmac("sha256", salt).update(address).digest("hex");
}

function encryptionKey(): Buffer {
  const encoded = process.env.LAUNCHER_AUTH_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Launcher handoff encryption key is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Launcher handoff encryption key must be 32 bytes in base64.");
  return key;
}

export function encryptSession(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSession(value: string): unknown {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted launcher session.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}

export function safeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function getClientAddress(request: Request): string {
  // Prefer hosting-provider injected IP headers over the generally client-controllable forwarded chain.
  const providerAddress = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = providerAddress || realIp || forwardedFor || "local-development";
  return address.slice(0, 128);
}
