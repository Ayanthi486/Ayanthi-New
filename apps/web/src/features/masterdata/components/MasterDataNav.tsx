import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/masterdata/shippers', label: 'Shippers' },
  { to: '/masterdata/consignees', label: 'Consignees' },
  { to: '/masterdata/airlines', label: 'Airlines' },
  { to: '/masterdata/airports', label: 'Airports' },
  { to: '/masterdata/commodities', label: 'Commodities' },
  { to: '/masterdata/flights', label: 'Flights' },
];

/** Sub-nav between the Shippers and Consignees master-data screens — each gated by its own broader-than-masterdata.manage permission, same as Commodities/Airports/Airlines (see App.tsx). */
export function MasterDataNav() {
  const location = useLocation();

  return (
    <nav className="border-border flex gap-4 border-b pb-2 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={cn(
            'hover:underline',
            location.pathname === link.to && 'text-primary font-medium underline',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
