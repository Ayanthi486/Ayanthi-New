import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { MeResponse } from '@hub-lanka/shared';
import { memoryStorage } from 'multer';
import { ValidationError } from '../common/errors/app-error';
import { AuthenticatedOnly } from './decorators/authenticated.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';
import type { RequestUser } from './types';

// Infra-level backstop only, same pattern as PaymentController — the real
// AVATAR_MAX_SIZE_MB business limit is enforced in ProfileService, after
// the file is actually buffered.
const MULTER_HARD_CEILING_BYTES = 5 * 1024 * 1024;

/**
 * Self-service "my own profile" endpoints — deliberately separate from
 * UsersController (which is identity.user.manage/admin-only and operates on
 * an arbitrary :id). Every route here acts on CurrentUser()'s own id, so
 * @AuthenticatedOnly() (any logged-in user) is the correct and complete
 * guard — there is no :id param for another user's id to leak into.
 */
@ApiTags('profile')
@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @AuthenticatedOnly()
  @Patch('me')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<MeResponse> {
    return this.profileService.updateFullName(actor.id, dto.fullName, actor);
  }

  @AuthenticatedOnly()
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CEILING_BYTES },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: RequestUser,
  ): Promise<MeResponse> {
    if (!file) {
      throw new ValidationError('No file was uploaded');
    }
    return this.profileService.uploadAvatar(
      actor.id,
      { buffer: file.buffer, mimetype: file.mimetype },
      actor,
    );
  }

  @AuthenticatedOnly()
  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() actor: RequestUser): Promise<MeResponse> {
    return this.profileService.removeAvatar(actor.id, actor);
  }

  @AuthenticatedOnly()
  @Get('me/avatar')
  async getAvatar(@CurrentUser() actor: RequestUser): Promise<StreamableFile> {
    const { buffer, contentType } = await this.profileService.getAvatar(actor.id);
    return new StreamableFile(buffer, { type: contentType });
  }
}
