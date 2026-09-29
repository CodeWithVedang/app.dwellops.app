import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "@/lib/db/client";

/** Replaceable binary store (PRD §30). Metadata lives in `file_assets`; bytes live here. */
export interface FileStorage {
  readonly name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

/** Keys are generated server-side; still refuse anything that could escape the root. */
function assertSafeKey(key: string): void {
  if (!/^[A-Za-z0-9/_.-]+$/.test(key) || key.includes("..") || key.startsWith("/")) throw new Error("Unsafe storage key");
}

/** Dev/test: files under a local folder (git-ignored). Not usable on serverless hosts. */
export class LocalDiskStorage implements FileStorage {
  readonly name = "local";
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    assertSafeKey(key);
    return path.join(this.root, ...key.split("/"));
  }
  async put(key: string, body: Uint8Array) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

/** Production: any S3-compatible bucket. Bucket must be private; downloads go through our authorized route. */
export class S3Storage implements FileStorage {
  readonly name = "s3";
  private readonly client: S3Client;
  constructor(private readonly bucket: string, opts: { endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint || undefined,
      forcePathStyle: !!opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    assertSafeKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string) {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }
  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Production without an object store: bytes in the `file_blobs` table. Private by construction
 * (downloads go through the authorized route). Counts toward database size and backups.
 */
export class PostgresStorage implements FileStorage {
  readonly name = "postgres";
  async put(key: string, body: Uint8Array, contentType: string) {
    assertSafeKey(key);
    // Keys are unique per upload; upsert makes a retried upload idempotent.
    const content = new Uint8Array(body);
    await db.fileBlob.upsert({ where: { key }, create: { key, content, contentType }, update: { content, contentType } });
  }
  async get(key: string) {
    assertSafeKey(key);
    const row = await db.fileBlob.findUnique({ where: { key }, select: { content: true } });
    return row ? new Uint8Array(row.content) : null;
  }
  async delete(key: string) {
    assertSafeKey(key);
    await db.fileBlob.deleteMany({ where: { key } });
  }
}

const g = globalThis as unknown as { __nivasoStorage?: FileStorage };

export function fileStorage(): FileStorage {
  if (g.__nivasoStorage) return g.__nivasoStorage;
  const { STORAGE_BUCKET, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_ENDPOINT, STORAGE_REGION } = process.env;
  let s: FileStorage;
  if (STORAGE_BUCKET && STORAGE_ACCESS_KEY && STORAGE_SECRET_KEY) {
    s = new S3Storage(STORAGE_BUCKET, {
      endpoint: STORAGE_ENDPOINT,
      region: STORAGE_REGION || "auto",
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET_KEY,
    });
  } else if (process.env.STORAGE_PROVIDER === "postgres" || (process.env.NODE_ENV === "production" && process.env.STORAGE_PROVIDER !== "local")) {
    // Production default when no bucket is configured: serverless hosts have no writable disk.
    s = new PostgresStorage();
  } else {
    const dir = process.env.NODE_ENV === "test" ? ".storage/test" : ".storage/dev";
    s = new LocalDiskStorage(path.resolve(process.cwd(), dir));
  }
  g.__nivasoStorage = s;
  return s;
}
