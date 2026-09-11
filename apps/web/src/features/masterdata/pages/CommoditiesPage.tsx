import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCommodityRequestSchema,
  type Commodity,
  type CreateCommodityRequest,
} from '@hub-lanka/shared';
import type { ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MasterDataListPage } from '@/features/masterdata/components/MasterDataListPage';
import {
  useCommodities,
  useCreateCommodity,
  useDeactivateCommodity,
} from '@/features/masterdata/hooks/useMasterdata';

const columns: ColumnDef<Commodity, unknown>[] = [
  { header: 'Name', accessorKey: 'name' },
  { header: 'Code', accessorKey: 'code' },
  { header: 'Delay Hours', accessorKey: 'delayHours' },
];

/** BR-17: Executive and Manager may both add commodities — unlike the other four entities, which are Manager-only. */
export function CommoditiesPage() {
  return (
    <MasterDataListPage<Commodity, CreateCommodityRequest>
      title="Commodities"
      description="Executive and Manager may both add commodities; deactivating one is Manager-only."
      resolver={zodResolver(createCommodityRequestSchema)}
      columns={columns}
      useList={useCommodities}
      useCreate={useCreateCommodity}
      useDeactivate={useDeactivateCommodity}
      renderCreateFields={(register) => {
        const codeField = register('code');
        return (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commodity-name">Name</Label>
              <Input id="commodity-name" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commodity-code">Code</Label>
              <Input
                id="commodity-code"
                placeholder="e.g. 123456"
                maxLength={6}
                {...codeField}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  void codeField.onChange(e);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commodity-delay-hours">Delay Hours</Label>
              <Input id="commodity-delay-hours" type="time" {...register('delayHours')} />
            </div>
          </>
        );
      }}
    />
  );
}
