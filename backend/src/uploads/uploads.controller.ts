import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ImageModerationService } from '../image-moderation/image-moderation.service';
import { UploadsService } from './uploads.service';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly imageModerator: ImageModerationService,
  ) {}

  @Post('image')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async image(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_BYTES })
        .addFileTypeValidator({ fileType: ALLOWED_MIME })
        .build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('no file');

    // Run image moderation before we ever persist the file. On reject the
    // bytes never hit disk; a ModerationLog row is written either way.
    const contentId = randomUUID();
    const moderation = await this.imageModerator.check({
      buffer: file.buffer,
      mime: file.mimetype,
      filename: file.originalname,
      contentId,
    });
    if (!moderation.allowed) {
      throw new BadRequestException({
        message: 'image rejected by content policy',
        categories: moderation.categories,
        reason: moderation.reason,
      });
    }

    return this.uploads.saveImage(file.buffer, file.originalname, file.mimetype);
  }
}
