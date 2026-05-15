import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { extname, join } from 'path';

export interface UploadedFile {
  url: string;
  mime: string;
  size: number;
}

/**
 * Stores uploaded files on local disk under {UPLOAD_DIR}/{yyyymm}/{uuid}{ext}
 * and returns a public URL served by the static handler in main.ts.
 *
 * Production should swap this for an S3 presigned-PUT flow (aws-sdk-s3) and
 * have the client upload directly to S3, bypassing the app server. The
 * interface here matches that future shape: returns a `url` you can use.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly uploadDir: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
    this.publicBase = this.config.get<string>('UPLOAD_PUBLIC_BASE', '/uploads');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`created upload dir ${this.uploadDir}`);
    }
  }

  async saveImage(buffer: Buffer, originalname: string, mimetype: string): Promise<UploadedFile> {
    if (!mimetype.startsWith('image/')) {
      throw new Error('only image/* mimetypes are accepted');
    }
    const ext = (extname(originalname) || `.${mimetype.split('/')[1] || 'bin'}`).toLowerCase();
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
    const dir = join(this.uploadDir, yyyymm);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    const fullPath = join(dir, filename);
    await writeFile(fullPath, buffer);
    return {
      url: `${this.publicBase}/${yyyymm}/${filename}`,
      mime: mimetype,
      size: buffer.length,
    };
  }

  get localDir(): string {
    return this.uploadDir;
  }
}
