import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import {
  DOCUMENT_TYPES,
  type DocumentReadiness,
  type DocumentType,
  type ShipmentDocument,
} from '@hub-lanka/shared';
import { memoryStorage } from 'multer';
import { ValidationError } from '../common/errors/app-error';
import { AuthenticatedOnly } from '../identity/decorators/authenticated.decorator';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { DocumentsService } from './documents.service';
import { SaveDocumentDto } from './dto/save-document.dto';

// Same infra-level backstop as PaymentController — the service's own
// validateFileKind is the real business rule check.
const MULTER_HARD_CEILING_BYTES = 25 * 1024 * 1024;

function parseType(value: string): DocumentType {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError(`Unknown document type: ${value}`);
  }
  return value as DocumentType;
}

@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('shipments/:shipmentId/documents/readiness')
  @AuthenticatedOnly()
  async getReadiness(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<DocumentReadiness> {
    return this.documentsService.getReadiness(shipmentId, actor);
  }

  @Post('shipments/:shipmentId/documents/:type')
  @RequirePermission('documents.manage')
  async ensureDraft(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentDocument> {
    return this.documentsService.ensureDraft(shipmentId, parseType(type), actor);
  }

  @Get('shipments/:shipmentId/documents/:type')
  @AuthenticatedOnly()
  async getLatest(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentDocument> {
    return this.documentsService.getLatest(shipmentId, parseType(type), actor);
  }

  @Patch('shipments/:shipmentId/documents/:type')
  @RequirePermission('documents.manage')
  async updateFieldData(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: string,
    @Body() dto: SaveDocumentDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentDocument> {
    return this.documentsService.updateFieldData(shipmentId, parseType(type), dto.fieldData, actor);
  }

  @Post('shipments/:shipmentId/documents/:type/upload')
  @RequirePermission('documents.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CEILING_BYTES },
    }),
  )
  async upload(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentDocument> {
    if (!file) throw new ValidationError('A file is required');
    return this.documentsService.uploadFile(
      shipmentId,
      parseType(type),
      { buffer: file.buffer, mimetype: file.mimetype },
      actor,
    );
  }

  @Post('shipments/:shipmentId/documents/:type/issue')
  @RequirePermission('documents.manage')
  async issue(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<ShipmentDocument> {
    return this.documentsService.issue(shipmentId, parseType(type), actor);
  }

  @Get('shipments/:shipmentId/documents/:type/print')
  @AuthenticatedOnly()
  async getPrintPayload(
    @Param('shipmentId') shipmentId: string,
    @Param('type') type: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<{ html: string; pageSize: string }> {
    return this.documentsService.getPrintPayload(shipmentId, parseType(type), actor);
  }

  @Get('documents/:id/file')
  @AuthenticatedOnly()
  async downloadFile(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.documentsService.downloadFile(id, actor);
    const ext = filename.split('.').pop()?.toLowerCase();
    const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' 
               : ext === 'png' ? 'image/png' 
               : 'application/pdf';
    return new StreamableFile(buffer, {
      type,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
