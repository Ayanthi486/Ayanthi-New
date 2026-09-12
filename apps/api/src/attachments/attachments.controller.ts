import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { ShipmentAttachment } from '@hub-lanka/shared';
import { memoryStorage } from 'multer';
import { ValidationError } from '../common/errors/app-error';
import { AuthenticatedOnly } from '../identity/decorators/authenticated.decorator';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { AttachmentsService } from './attachments.service';

// Same infra-level backstop as PaymentController/DocumentsController — the
// service's own validateFileKind is the real business rule check.
const MULTER_HARD_CEILING_BYTES = 25 * 1024 * 1024;

@ApiTags('attachments')
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get('shipments/:shipmentId/attachments')
  @AuthenticatedOnly()
  async list(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentAttachment[]> {
    return this.attachmentsService.list(shipmentId, actor);
  }

  @Post('shipments/:shipmentId/attachments')
  @RequirePermission('documents.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CEILING_BYTES },
    }),
  )
  async upload(
    @Param('shipmentId') shipmentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentAttachment> {
    if (!file) throw new ValidationError('A file is required');
    return this.attachmentsService.upload(
      shipmentId,
      { buffer: file.buffer, mimetype: file.mimetype, originalname: file.originalname },
      actor,
    );
  }

  @Get('attachments/:id/file')
  @AuthenticatedOnly()
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<StreamableFile> {
    const { buffer, attachment } = await this.attachmentsService.download(id, actor);
    return new StreamableFile(buffer, {
      type: attachment.contentType,
      disposition: `attachment; filename="${attachment.filename.replace(/"/g, '')}"`,
    });
  }

  @Delete('attachments/:id')
  @RequirePermission('documents.manage')
  async remove(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<{ ok: true }> {
    await this.attachmentsService.remove(id, actor);
    return { ok: true };
  }
}
