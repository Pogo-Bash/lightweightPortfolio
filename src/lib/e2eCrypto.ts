// E2E encryption for ghost-chat using ECDH key exchange + AES-256-GCM
// All messages/files are encrypted before leaving the client,
// so neither the signaling server nor any relay can read them.

const ECDH_PARAMS: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };
const AES_ALGO = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit nonce for AES-GCM

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Generate an ECDH key pair for this session */
export async function generateKeyPair(): Promise<KeyPair> {
  const kp = await crypto.subtle.generateKey(ECDH_PARAMS, false, [
    "deriveKey",
  ]);
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

/** Export a public key to a transferable JSON Web Key */
export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

/** Import a peer's public key from JWK */
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ECDH_PARAMS, false, []);
}

/** Derive a shared AES-256-GCM key from our private key + peer's public key */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt a string message. Returns base64(iv + ciphertext). */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    key,
    encoded
  );
  // Prepend IV to ciphertext
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return uint8ToBase64(combined);
}

/** Decrypt a base64(iv + ciphertext) string back to plaintext. */
export async function decryptMessage(
  key: CryptoKey,
  encrypted: string
): Promise<string> {
  const combined = base64ToUint8(encrypted);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGO, iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

/** Encrypt an ArrayBuffer (for file chunks). Returns ArrayBuffer with IV prepended. */
export async function encryptBuffer(
  key: CryptoKey,
  data: ArrayBuffer
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_ALGO, iv },
    key,
    data
  );
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return combined.buffer;
}

/** Decrypt an ArrayBuffer with IV prepended. */
export async function decryptBuffer(
  key: CryptoKey,
  data: ArrayBuffer
): Promise<ArrayBuffer> {
  const combined = new Uint8Array(data);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  return crypto.subtle.decrypt({ name: AES_ALGO, iv }, key, ciphertext);
}

// --- Base64 helpers (browser-safe, no btoa char limit issues) ---

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
