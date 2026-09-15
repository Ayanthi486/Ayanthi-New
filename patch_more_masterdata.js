const fs = require('fs');

// --- 1. SHARED ---
let shared = fs.readFileSync('packages/shared/src/masterdata.ts', 'utf8');
shared = shared.replace(
  `export type CreateAirlineRequest = z.infer<typeof createAirlineRequestSchema>;`,
  `export type CreateAirlineRequest = z.infer<typeof createAirlineRequestSchema>;

export const updateAirlineRequestSchema = createAirlineRequestSchema;
export type UpdateAirlineRequest = z.infer<typeof updateAirlineRequestSchema>;`
);
shared = shared.replace(
  `export type CreateShipperRequest = z.infer<typeof createShipperRequestSchema>;`,
  `export type CreateShipperRequest = z.infer<typeof createShipperRequestSchema>;

export const updateShipperRequestSchema = createShipperRequestSchema;
export type UpdateShipperRequest = z.infer<typeof updateShipperRequestSchema>;`
);
shared = shared.replace(
  `export type CreateConsigneeRequest = z.infer<typeof createConsigneeRequestSchema>;`,
  `export type CreateConsigneeRequest = z.infer<typeof createConsigneeRequestSchema>;

export const updateConsigneeRequestSchema = createConsigneeRequestSchema;
export type UpdateConsigneeRequest = z.infer<typeof updateConsigneeRequestSchema>;`
);
fs.writeFileSync('packages/shared/src/masterdata.ts', shared);

// --- 2. DTOs ---
fs.writeFileSync('apps/api/src/masterdata/dto/update-airline.dto.ts', `import { updateAirlineRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateAirlineDto extends createZodDto(updateAirlineRequestSchema) {}`);

fs.writeFileSync('apps/api/src/masterdata/dto/update-shipper.dto.ts', `import { updateShipperRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateShipperDto extends createZodDto(updateShipperRequestSchema) {}`);

fs.writeFileSync('apps/api/src/masterdata/dto/update-consignee.dto.ts', `import { updateConsigneeRequestSchema } from '@hub-lanka/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateConsigneeDto extends createZodDto(updateConsigneeRequestSchema) {}`);

// --- 3. SERVICES ---
// Airlines
let airSvc = fs.readFileSync('apps/api/src/masterdata/airlines.service.ts', 'utf8');
airSvc = airSvc.replace(
  `import type { Airline, CreateAirlineRequest } from '@hub-lanka/shared';`,
  `import type { Airline, CreateAirlineRequest, UpdateAirlineRequest } from '@hub-lanka/shared';`
);
airSvc = airSvc.replace(
  `  async deactivate`,
  `  async update(id: string, input: UpdateAirlineRequest, actor: RequestUser): Promise<Airline> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.airline.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Airline not found');
        return tx.airline.update({
          where: { id },
          data: { name: input.name, code: input.code },
        });
      },
    );
    return toAirline(updated);
  }

  async deactivate`
);
fs.writeFileSync('apps/api/src/masterdata/airlines.service.ts', airSvc);

// Shippers
let shipSvc = fs.readFileSync('apps/api/src/masterdata/shippers.service.ts', 'utf8');
shipSvc = shipSvc.replace(
  `import type { CreateShipperRequest, Shipper } from '@hub-lanka/shared';`,
  `import type { CreateShipperRequest, Shipper, UpdateShipperRequest } from '@hub-lanka/shared';`
);
shipSvc = shipSvc.replace(
  `  async deactivate`,
  `  async update(id: string, input: UpdateShipperRequest, actor: RequestUser): Promise<Shipper> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.shipper.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Shipper not found');
        return tx.shipper.update({
          where: { id },
          data: { name: input.name, address: input.address, contact: input.contact },
        });
      },
    );
    return toShipper(updated);
  }

  async deactivate`
);
fs.writeFileSync('apps/api/src/masterdata/shippers.service.ts', shipSvc);

// Consignees
let conSvc = fs.readFileSync('apps/api/src/masterdata/consignees.service.ts', 'utf8');
conSvc = conSvc.replace(
  `import type { Consignee, CreateConsigneeRequest } from '@hub-lanka/shared';`,
  `import type { Consignee, CreateConsigneeRequest, UpdateConsigneeRequest } from '@hub-lanka/shared';`
);
conSvc = conSvc.replace(
  `  async deactivate`,
  `  async update(id: string, input: UpdateConsigneeRequest, actor: RequestUser): Promise<Consignee> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.consignee.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Consignee not found');
        return tx.consignee.update({
          where: { id },
          data: { name: input.name, address: input.address, contact: input.contact },
        });
      },
    );
    return toShipper(updated);
  }

  async deactivate`
);
fs.writeFileSync('apps/api/src/masterdata/consignees.service.ts', conSvc);

// --- 4. CONTROLLERS ---
// Airlines
let airCtrl = fs.readFileSync('apps/api/src/masterdata/airlines.controller.ts', 'utf8');
airCtrl = airCtrl.replace(
  `import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';`,
  `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';`
);
airCtrl = airCtrl.replace(
  `import { CreateAirlineDto } from './dto/create-airline.dto';`,
  `import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';`
);
airCtrl = airCtrl.replace(
  `  @Delete(':id')`,
  `  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAirlineDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Airline> {
    return this.airlinesService.update(id, dto, actor);
  }

  @Delete(':id')`
);
fs.writeFileSync('apps/api/src/masterdata/airlines.controller.ts', airCtrl);

// Shippers
let shipCtrl = fs.readFileSync('apps/api/src/masterdata/shippers.controller.ts', 'utf8');
shipCtrl = shipCtrl.replace(
  `import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';`,
  `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';`
);
shipCtrl = shipCtrl.replace(
  `import { CreateShipperDto } from './dto/create-shipper.dto';`,
  `import { CreateShipperDto } from './dto/create-shipper.dto';
import { UpdateShipperDto } from './dto/update-shipper.dto';`
);
shipCtrl = shipCtrl.replace(
  `  @Delete(':id')`,
  `  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShipperDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipper> {
    return this.shippersService.update(id, dto, actor);
  }

  @Delete(':id')`
);
fs.writeFileSync('apps/api/src/masterdata/shippers.controller.ts', shipCtrl);

// Consignees
let conCtrl = fs.readFileSync('apps/api/src/masterdata/consignees.controller.ts', 'utf8');
conCtrl = conCtrl.replace(
  `import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';`,
  `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';`
);
conCtrl = conCtrl.replace(
  `import { CreateConsigneeDto } from './dto/create-consignee.dto';`,
  `import { CreateConsigneeDto } from './dto/create-consignee.dto';
import { UpdateConsigneeDto } from './dto/update-consignee.dto';`
);
conCtrl = conCtrl.replace(
  `  @Delete(':id')`,
  `  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConsigneeDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Consignee> {
    return this.consigneesService.update(id, dto, actor);
  }

  @Delete(':id')`
);
fs.writeFileSync('apps/api/src/masterdata/consignees.controller.ts', conCtrl);

// --- 5. FRONTEND API & HOOKS ---
let frontApi = fs.readFileSync('apps/web/src/features/masterdata/api/masterdataApi.ts', 'utf8');
frontApi = frontApi.replace(
  `  UpdateFlightRequest,`,
  `  UpdateFlightRequest,
  UpdateAirlineRequest,
  UpdateShipperRequest,
  UpdateConsigneeRequest,`
);
frontApi += `
export async function updateAirline(id: string, input: UpdateAirlineRequest): Promise<Airline> {
  return apiFetch(\`/masterdata/airlines/\${id}\`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function updateShipper(id: string, input: UpdateShipperRequest): Promise<Shipper> {
  return apiFetch(\`/masterdata/shippers/\${id}\`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function updateConsignee(id: string, input: UpdateConsigneeRequest): Promise<Consignee> {
  return apiFetch(\`/masterdata/consignees/\${id}\`, { method: 'PATCH', body: JSON.stringify(input) });
}
`;
fs.writeFileSync('apps/web/src/features/masterdata/api/masterdataApi.ts', frontApi);

let frontHooks = fs.readFileSync('apps/web/src/features/masterdata/hooks/useMasterdata.ts', 'utf8');
frontHooks = frontHooks.replace(
  `  updateFlight,`,
  `  updateFlight,
  updateAirline,
  updateShipper,
  updateConsignee,`
);
frontHooks += `
export function useUpdateAirline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAirline>[1] }) => updateAirline(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['airlines'] }),
  });
}

export function useUpdateShipper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateShipper>[1] }) => updateShipper(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shippers'] }),
  });
}

export function useUpdateConsignee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateConsignee>[1] }) => updateConsignee(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consignees'] }),
  });
}
`;
fs.writeFileSync('apps/web/src/features/masterdata/hooks/useMasterdata.ts', frontHooks);

// --- 6. FRONTEND PAGES ---
let airPage = fs.readFileSync('apps/web/src/features/masterdata/pages/AirlinesPage.tsx', 'utf8');
airPage = airPage.replace(
  `  useCreateAirline,\n  useDeactivateAirline,`,
  `  useCreateAirline,
  useDeactivateAirline,
  useUpdateAirline,`
);
airPage = airPage.replace(
  `useDeactivate={useDeactivateAirline}`,
  `useDeactivate={useDeactivateAirline}\n      useUpdate={useUpdateAirline}`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/AirlinesPage.tsx', airPage);

let shipPage = fs.readFileSync('apps/web/src/features/masterdata/pages/ShippersPage.tsx', 'utf8');
shipPage = shipPage.replace(
  `  useCreateShipper,\n  useDeactivateShipper,`,
  `  useCreateShipper,
  useDeactivateShipper,
  useUpdateShipper,`
);
shipPage = shipPage.replace(
  `useDeactivate={useDeactivateShipper}`,
  `useDeactivate={useDeactivateShipper}\n      useUpdate={useUpdateShipper}`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/ShippersPage.tsx', shipPage);

let conPage = fs.readFileSync('apps/web/src/features/masterdata/pages/ConsigneesPage.tsx', 'utf8');
conPage = conPage.replace(
  `  useCreateConsignee,\n  useDeactivateConsignee,`,
  `  useCreateConsignee,
  useDeactivateConsignee,
  useUpdateConsignee,`
);
conPage = conPage.replace(
  `useDeactivate={useDeactivateConsignee}`,
  `useDeactivate={useDeactivateConsignee}\n      useUpdate={useUpdateConsignee}`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/ConsigneesPage.tsx', conPage);

