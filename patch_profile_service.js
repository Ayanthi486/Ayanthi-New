const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/profile.service.ts', 'utf8');

// 1. Add signatureStorageKey to ProfileUser
file = file.replace(
  `  avatarStorageKey: string | null;`,
  `  avatarStorageKey: string | null;
  signatureStorageKey: string | null;`
);

// 2. Add signature fields to me map
file = file.replace(
  `      hasAvatar: user.avatarStorageKey !== null,`,
  `      hasAvatar: user.avatarStorageKey !== null,
      hasSignature: user.signatureStorageKey !== null,`
);

// 3. Add signature handling methods
const methods = `
  async uploadSignature(file: UploadedAvatar, actor: RequestUser): Promise<MeResponse> {
    const kind = validateFileKind(file.mimetype, file.buffer);
    if (kind !== 'image') {
      throw new BusinessRuleError('Only images (JPEG, PNG) are allowed for signatures');
    }

    const saved = await this.storage.save({
      buffer: file.buffer,
      prefix: 'signatures',
      extension: extensionForKind(kind),
    });

    const { user: updatedUser, previousKey } = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const before = await tx.user.findUniqueOrThrow({
          where: { id: actor.id },
          select: { signatureStorageKey: true },
        });
        const updatedUser = await tx.user.update({
          where: { id: actor.id },
          data: { signatureStorageKey: saved.key },
          include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
        });
        return { user: updatedUser, previousKey: before.signatureStorageKey };
      },
    );

    if (previousKey) {
      await this.storage.delete(previousKey).catch((err) => {
        // Non-fatal, just a leak.
        console.error('Failed to delete old signature:', previousKey, err);
      });
    }

    return this.mapToResponse(updatedUser);
  }

  async removeSignature(actor: RequestUser): Promise<MeResponse> {
    const { user: updatedUser, previousKey } = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const before = await tx.user.findUniqueOrThrow({
          where: { id: actor.id },
          select: { signatureStorageKey: true },
        });
        if (!before.signatureStorageKey) throw new NotFoundError('No signature found');

        const updatedUser = await tx.user.update({
          where: { id: actor.id },
          data: { signatureStorageKey: null },
          include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
        });
        return { user: updatedUser, previousKey: before.signatureStorageKey };
      },
    );

    if (previousKey) {
      await this.storage.delete(previousKey).catch(() => {});
    }
    return this.mapToResponse(updatedUser);
  }

  async downloadSignature(actor: RequestUser): Promise<{ buffer: Buffer; contentType: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { signatureStorageKey: true },
    });
    if (!user.signatureStorageKey) {
      throw new NotFoundError('No signature is set');
    }

    const buffer = await this.storage.read(user.signatureStorageKey);
    return { buffer, contentType: mimeTypeForKey(user.signatureStorageKey) };
  }
`;

file = file.replace(
  `  async downloadAvatar(actor: RequestUser): Promise<{ buffer: Buffer; contentType: string }> {`,
  methods + `\n  async downloadAvatar(actor: RequestUser): Promise<{ buffer: Buffer; contentType: string }> {`
);

fs.writeFileSync('apps/api/src/identity/profile.service.ts', file);
