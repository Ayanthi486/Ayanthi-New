import { cn } from '@/lib/utils';

const LOGO_SRC = '/assets/branding/hub-lanka-logo.png';

const LOGO_SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
} as const;

const WORDMARK_SIZES = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

/**
 * Official Hub Lanka logo paired with the system wordmark. The logo asset
 * (apps/web/public/assets/branding) is the company's real mark, sourced
 * from hublanka.lk — do not replace it with a generated icon.
 */
export function BrandMark({
  size = 'md',
  /** Use 'h1' when this is the primary page heading (e.g. the login page). */
  as: Wordmark = 'span',
  className,
}: {
  size?: keyof typeof LOGO_SIZES;
  as?: 'h1' | 'span';
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={LOGO_SRC}
        alt="Hub Lanka"
        className={cn(LOGO_SIZES[size], 'w-auto shrink-0 object-contain')}
      />
      <div className="flex flex-col leading-none">
        <Wordmark
          className={cn(
            'text-brand-navy font-semibold tracking-tight uppercase',
            WORDMARK_SIZES[size],
          )}
        >
          Hub Lanka
        </Wordmark>
        <span className="text-muted-foreground text-xs">Freight Forwarding Management System</span>
      </div>
    </div>
  );
}
