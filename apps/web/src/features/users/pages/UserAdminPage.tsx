import { zodResolver } from '@hookform/resolvers/zod';
import { createUserRequestSchema, type CreateUserRequest } from '@hub-lanka/shared';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateUser,
  useRoles,
  useSetUserActive,
  useUsers,
} from '@/features/users/hooks/useUsers';
import { ApiClientError } from '@/lib/apiClient';

/** Minimal user administration — gated server-side by identity.user.manage. */
export function UserAdminPage() {
  const usersQuery = useUsers();
  const rolesQuery = useRoles();
  const createUserMutation = useCreateUser();
  const setActiveMutation = useSetUserActive();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserRequest>({
    resolver: zodResolver(createUserRequestSchema),
    defaultValues: { roleIds: [] },
  });

  const onSubmit = handleSubmit((values) => {
    createUserMutation.mutate(values, { onSuccess: () => reset() });
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">User administration</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create accounts and manage role assignments.
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="border-border bg-card flex flex-col gap-4 rounded-lg border p-6"
      >
        <h2 className="font-medium">New user</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName && (
              <p className="text-destructive text-xs">{errors.fullName.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Temporary password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roleIds">Role</Label>
            <select
              id="roleIds"
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
              {...register('roleIds.0')}
            >
              <option value="">Select a role…</option>
              {rolesQuery.data?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {errors.roleIds && <p className="text-destructive text-xs">{errors.roleIds.message}</p>}
          </div>
        </div>

        {createUserMutation.isError && (
          <p className="text-destructive text-sm">
            {createUserMutation.error instanceof ApiClientError
              ? createUserMutation.error.message
              : 'Unable to create the user.'}
          </p>
        )}

        <Button type="submit" disabled={createUserMutation.isPending} className="self-start">
          {createUserMutation.isPending ? 'Creating…' : 'Create user'}
        </Button>
      </form>

      <div className="border-border bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.data?.map((user) => (
              <tr key={user.id} className="border-border border-b last:border-0">
                <td className="px-4 py-3">{user.fullName}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.roles.map((r) => r.name).join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  <span className={user.isActive ? 'text-green-600' : 'text-muted-foreground'}>
                    {user.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setActiveMutation.isPending}
                    onClick={() =>
                      setActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
                    }
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {usersQuery.isLoading && <p className="text-muted-foreground p-4 text-sm">Loading…</p>}
      </div>
    </div>
  );
}
