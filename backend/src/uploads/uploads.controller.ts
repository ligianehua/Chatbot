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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = /^image\/(jpeg|png|webp|gif)$/;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

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
    return this.uploads.saveImage(file.buffer, file.originalname, file.mimetype);
  }
}
