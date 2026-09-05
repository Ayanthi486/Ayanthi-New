import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Exempts a route from JwtAuthGuard and PermissionsGuard (both global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
