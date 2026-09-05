import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsSummaryGroup } from '@hub-lanka/shared';

const PIE_COLORS = ['#0ea5e9', '#f97316', '#a855f7', '#22c55e'];

/**
 * PRD §10: "Bar and pie charts, with numbers alongside" — the chart is
 * never the sole place a figure appears; the table below repeats every
 * number the chart shows.
 */
export function SummaryChart({
  groups,
  totals,
}: {
  groups: AnalyticsSummaryGroup[];
  totals: AnalyticsSummaryGroup;
}) {
  const weightData = groups.map((g) => ({ label: g.label, weightKg: Number(g.weightKg) }));
  const financialComposition = [
    { name: 'Buying cost', value: Number(totals.buyingCostLkr) },
    { name: 'Operational expenses', value: Number(totals.opexLkr) },
    { name: 'Profit', value: Number(totals.profitLkr) },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border-border bg-card rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium">Weight by group (kg)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weightData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="weightKg" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border-border bg-card rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium">
            Revenue LKR {totals.revenueLkr} — cost/expense/profit composition
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={financialComposition}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {financialComposition.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b text-left">
              <th className="py-2 pr-4">Group</th>
              <th className="py-2 pr-4">Shipments</th>
              <th className="py-2 pr-4">Weight (kg)</th>
              <th className="py-2 pr-4">Revenue (USD)</th>
              <th className="py-2 pr-4">Revenue (LKR)</th>
              <th className="py-2 pr-4">Buying Cost (LKR)</th>
              <th className="py-2 pr-4">Opex (LKR)</th>
              <th className="py-2 pr-4">Profit (LKR)</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-border/50 border-b">
                <td className="py-2 pr-4">{g.label}</td>
                <td className="py-2 pr-4">{g.shipmentCount}</td>
                <td className="py-2 pr-4">{g.weightKg}</td>
                <td className="py-2 pr-4">{g.revenueUsd}</td>
                <td className="py-2 pr-4">{g.revenueLkr}</td>
                <td className="py-2 pr-4">{g.buyingCostLkr}</td>
                <td className="py-2 pr-4">{g.opexLkr}</td>
                <td className="py-2 pr-4">{g.profitLkr}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-2 pr-4">Total</td>
              <td className="py-2 pr-4">{totals.shipmentCount}</td>
              <td className="py-2 pr-4">{totals.weightKg}</td>
              <td className="py-2 pr-4">{totals.revenueUsd}</td>
              <td className="py-2 pr-4">{totals.revenueLkr}</td>
              <td className="py-2 pr-4">{totals.buyingCostLkr}</td>
              <td className="py-2 pr-4">{totals.opexLkr}</td>
              <td className="py-2 pr-4">{totals.profitLkr}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
