import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';

export interface SaveFileInput {
  buffer: Buffer;
  /** e.g. "payments" — becomes a subdirectory/key prefix, never user input. */
  prefix: string;
  extension: string;
}

export interface SavedFile {
  key: string;
  sha256: string;
  size: number;
}

/**
 * ARCHITECTURE §12: private by default, randomised keys (never the user's
 * filename), served through a permission-checked endpoint, sha256 stored
 * for tamper evidence. `LocalDiskStorageAdapter` below is the only
 * implementation for now — an R2 adapter behind this same abstract class is
 * a one-line provider swap once there's a real bucket to build against
 * (mirrors `ARCHITECTURE.md` §13's `PrinterAdapter` pattern).
 */
export abstract class StorageService {
  abstract save(input: SaveFileInput): Promise<SavedFile>;
  abstract read(key: string): Promise<Buffer>;
  /**
   * Only for mutable, non-audit-record files (e.g. a replaced/removed
   * profile photo) — documents/receipts are immutable business records and
   * are never deleted, so nothing else calls this today.
   */
  abstract delete(key: string): Promise<void>;
}

@Injectable()
export class LocalDiskStorageAdapter extends StorageService {
  private readonly baseDir: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    super();
    this.baseDir = resolve(config.get('STORAGE_LOCAL_DIR', { infer: true }));
  }

  async save(input: SaveFileInput): Promise<SavedFile> {
    const key = `${input.prefix}/${randomUUID()}.${input.extension}`;
    const path = this.resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.buffer);

    return {
      key,
      sha256: createHash('sha256').update(input.buffer).digest('hex'),
      size: input.buffer.length,
    };
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKeyPath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKeyPath(key), { force: true });
  }

  /**
   * `key` is always one this service generated itself (never taken
   * directly from client input) but resolving under `baseDir` and
   * rejecting any escape is a cheap, defence-in-depth guard against a
   * path-traversal key ever reaching here.
   */
  private resolveKeyPath(key: string): string {
    const path = resolve(join(this.baseDir, normalize(key)));
    if (path !== this.baseDir && !path.startsWith(this.baseDir + sep)) {
      throw new Error('Invalid storage key');
    }
    return path;
  }
}
