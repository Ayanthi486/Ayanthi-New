import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StorageModule } from '../storage/storage.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { PasswordHasherService } from './password-hasher.service';
import { PermissionsService } from './permissions.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // Registered without options: JwtAuthGuard signs/verifies with an
  // explicit secret per call (env-driven), so no global JwtModule config
  // is needed beyond making JwtService injectable. StorageModule is
  // imported for ProfileService's own-profile-photo uploads (ARCHITECTURE
  // §12 — same abstraction Payment/Documents already use).
  imports: [JwtModule.register({}), StorageModule],
  controllers: [AuthController, UsersController, RolesController, ProfileController],
  providers: [
    AuthService,
    PasswordHasherService,
    LockoutService,
    PermissionsService,
    UsersService,
    RolesService,
    ProfileService,
  ],
  // JwtAuthGuard/PermissionsGuard are registered as global APP_GUARDs by
  // AppModule instead (not here) — alongside ThrottlerGuard in a single
  // providers array, so execution order (rate-limit → authenticate →
  // authorize) is deterministic rather than depending on cross-module
  // resolution order. PermissionsService is exported so AppModule's
  // instance of PermissionsGuard can inject it.
  exports: [PermissionsService],
})
export class IdentityModule {}
