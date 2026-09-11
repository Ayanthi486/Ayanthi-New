import type { AnalyticsFilterQuery } from '@hub-lanka/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useAirlines,
  useCommodities,
  useShippers,
} from '@/features/masterdata/hooks/useMasterdata';

const selectClassName = 'border-input h-9 rounded-md border bg-transparent px-3 text-sm';

/** Filters shared by every dimension view and by CSV export — one filter set, one underlying query (ARCHITECTURE §17). */
export function AnalyticsFilters({
  value,
  onChange,
}: {
  value: AnalyticsFilterQuery;
  onChange: (next: AnalyticsFilterQuery) => void;
}) {
  const shippersQuery = useShippers();
  const airlinesQuery = useAirlines();
  const commoditiesQuery = useCommodities();

  const set = (patch: Partial<AnalyticsFilterQuery>) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateFrom">From</Label>
        <Input
          id="dateFrom"
          type="date"
          value={value.dateFrom ?? ''}
          onChange={(e) => set({ dateFrom: e.target.value || undefined })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateTo">To</Label>
        <Input
          id="dateTo"
          type="date"
          value={value.dateTo ?? ''}
          onChange={(e) => set({ dateTo: e.target.value || undefined })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="commodityId">Commodity</Label>
        <select
          id="commodityId"
          className={selectClassName}
          value={value.commodityId ?? ''}
          onChange={(e) => set({ commodityId: e.target.value || undefined })}
        >
          <option value="">All commodities</option>
          {commoditiesQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="airlineId">Airline</Label>
        <select
          id="airlineId"
          className={selectClassName}
          value={value.airlineId ?? ''}
          onChange={(e) => set({ airlineId: e.target.value || undefined })}
        >
          <option value="">All airlines</option>
          {airlinesQuery.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shipperId">Shipper</Label>
        <select
          id="shipperId"
          className={selectClassName}
          value={value.shipperId ?? ''}
          onChange={(e) => set({ shipperId: e.target.value || undefined })}
        >
          <option value="">All shippers</option>
          {shippersQuery.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
