/** Attached to `request.user` by JwtAuthGuard once the access token verifies. */
export interface RequestUser {
  id: string;
  email: string;
  fullName: string;
  hasAvatar: boolean;
  hasSignature: boolean;
  idCardNo: string | null;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}
