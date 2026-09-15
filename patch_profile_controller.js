const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/profile.controller.ts', 'utf8');

const signatureEndpoints = `
  @AuthenticatedOnly()
  @Post('me/signature')
  @UseInterceptors(
    FileInterceptor('signature', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CEILING_BYTES },
    }),
  )
  async uploadSignature(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: RequestUser,
  ): Promise<MeResponse> {
    if (!file) {
      throw new ValidationError('No file was uploaded');
    }
    return this.profileService.uploadSignature(
      { buffer: file.buffer, mimetype: file.mimetype },
      actor,
    );
  }

  @AuthenticatedOnly()
  @Delete('me/signature')
  async removeSignature(@CurrentUser() actor: RequestUser): Promise<MeResponse> {
    return this.profileService.removeSignature(actor);
  }

  @AuthenticatedOnly()
  @Get('me/signature')
  async getSignature(@CurrentUser() actor: RequestUser): Promise<StreamableFile> {
    const { buffer, contentType } = await this.profileService.downloadSignature(actor);
    return new StreamableFile(buffer, { type: contentType });
  }
`;

file = file.replace(
  `}
`,
  signatureEndpoints + `\n}\n`
);

fs.writeFileSync('apps/api/src/identity/profile.controller.ts', file);
