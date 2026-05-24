import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";

import env from "@/shared/configs/env";

/**
 * AES-256-GCM wrapper for encrypting short secrets (PATs, OAuth tokens) at rest.
 * The key is derived deterministically from APP_ENCRYPTION_KEY (or, if missing,
 * SESSION_SECRET as a development fallback) so rotation requires a re-encrypt
 * pass over stored ciphertexts.
 */

function getEncryptionKey(): Buffer {
  const material = env.APP_ENCRYPTION_KEY || env.SESSION_SECRET;
  return createHash("sha256").update(material).digest();
}

export type SealedSecret = {
  cipher: string;
  iv: string;
  tag: string;
};

export function sealSecret(plaintext: string): SealedSecret {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return {
    cipher: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function openSecret(sealed: SealedSecret): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(sealed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(sealed.cipher, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
