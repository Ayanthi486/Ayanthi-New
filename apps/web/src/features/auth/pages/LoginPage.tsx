import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@hub-lanka/shared';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/shared/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/features/auth/hooks/useLogin';
import { ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const user = useAuthStore((state) => state.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  // Covers a background session bootstrap (providers.tsx) resolving after
  // this page already rendered — e.g. a hard reload on a deep route
  // briefly shows /login before the refresh-cookie bootstrap completes.
  // Without this, an already-authenticated user could get stuck here.
  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  const onSubmit = handleSubmit((values) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        void navigate(returnTo, { replace: true });
      },
    });
  });

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark as="h1" size="lg" className="flex-col text-center" />
          <p className="text-muted-foreground mt-3 text-sm">Sign in to continue</p>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="border-border bg-card flex flex-col gap-4 rounded-lg border p-6"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>

          {loginMutation.isError && (
            <p className="text-destructive text-sm">
              {loginMutation.error instanceof ApiClientError
                ? loginMutation.error.message
                : 'Unable to sign in. Please try again.'}
            </p>
          )}

          <Button type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
