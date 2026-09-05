import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MasterDataOption {
  id: string;
  /** Shown in the list and in the input once selected (e.g. "DXB — Dubai"). */
  name: string;
  /** What duplicate-detection compares against; defaults to `name` (see the
   * Destination field, where `name` is a "CODE — City" display label but
   * the real underlying name is what a duplicate check should compare). */
  matchName?: string;
}

export interface MasterDataCreateField {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

export interface MasterDataComboboxProps {
  /** Used in copy: "No Shipper found", "+ Add New Shipper". */
  entityLabel: string;
  placeholder: string;
  options: MasterDataOption[];
  isLoading?: boolean;
  value: string;
  onChange: (id: string) => void;
  inputId?: string;
  ariaInvalid?: boolean;
  /** Gated by the real permission for this entity (RequirePermission-equivalent — presentation only). */
  canCreate: boolean;
  isCreating?: boolean;
  createError?: string;
  /** Defaults to a single required "Name" field. */
  createFields?: MasterDataCreateField[];
  onCreate: (input: Record<string, string>) => Promise<MasterDataOption>;
}

const DEFAULT_CREATE_FIELDS: MasterDataCreateField[] = [
  { key: 'name', label: 'Name', required: true },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Searchable combobox for a master-data field (Shipper/Consignee/Commodity/
 * Airline/Airport) — one reusable component per UX §8, configured per
 * entity rather than five near-duplicate implementations. Options are the
 * already-fully-loaded list each `useX()` hook returns (Phase 3's
 * masterdata endpoints have no server-side search), so "search" is
 * client-side substring filtering.
 *
 * ARIA combobox-with-listbox-popup pattern: the input is the trigger (via
 * `PopoverAnchor`, not `PopoverTrigger`, since a real trigger would toggle
 * open on click and steal semantics from typing/focus) with
 * `onOpenAutoFocus` prevented on the popover content so focus never leaves
 * the input while the listbox is open.
 */
export function MasterDataCombobox({
  entityLabel,
  placeholder,
  options,
  isLoading,
  value,
  onChange,
  inputId,
  ariaInvalid,
  canCreate,
  isCreating,
  createError,
  createFields = DEFAULT_CREATE_FIELDS,
  onCreate,
}: MasterDataComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  // Bumped every time the create dialog opens so it fully remounts with
  // fresh state (name/duplicate-confirmation) instead of syncing that via
  // an effect that runs after open flips true.
  const [createSession, setCreateSession] = useState(0);
  // A record this combobox itself just created. `onCreate`'s mutation
  // invalidates the underlying list query, but that refetch is async — for
  // the moment between "created" and "the list actually contains it",
  // `options` alone can't resolve `value` to a display name. Falls out of
  // use on its own once the refetched `options` includes the same id.
  const [justCreated, setJustCreated] = useState<MasterDataOption>();
  const listboxId = useId();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selected = useMemo(
    () =>
      options.find((o) => o.id === value) ?? (justCreated?.id === value ? justCreated : undefined),
    [options, value, justCreated],
  );

  // The displayed text: the selection's label when closed/idle, the live
  // search query while the user is actively typing/browsing.
  const displayValue = open ? query : (selected?.name ?? '');

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((o) => normalize(o.name).includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  function setQueryAndResetHighlight(next: string) {
    setQuery(next);
    setHighlightedIndex(0);
  }

  function openWithCurrentSelection() {
    setQueryAndResetHighlight(selected?.name ?? '');
    setOpen(true);
  }

  function selectOption(option: MasterDataOption) {
    onChange(option.id);
    setQueryAndResetHighlight('');
    setOpen(false);
  }

  function clearSelection() {
    onChange('');
    setQueryAndResetHighlight('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openWithCurrentSelection();
        return;
      }
      setHighlightedIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[highlightedIndex];
      if (open && option) selectOption(option);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQueryAndResetHighlight('');
    }
  }

  const activeOptionId =
    open && filtered[highlightedIndex]
      ? `${listboxId}-${filtered[highlightedIndex].id}`
      : undefined;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) openWithCurrentSelection();
          else setOpen(false);
        }}
      >
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <Input
              id={inputId}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              aria-invalid={ariaInvalid}
              autoComplete="off"
              placeholder={placeholder}
              className="pr-14"
              value={displayValue}
              onFocus={openWithCurrentSelection}
              onChange={(e) => {
                setQueryAndResetHighlight(e.target.value);
                if (!open) setOpen(true);
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute right-1.5 flex items-center gap-0.5">
              {value && (
                <button
                  type="button"
                  aria-label={`Clear ${entityLabel}`}
                  className="text-muted-foreground hover:text-foreground rounded-sm p-1"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearSelection}
                >
                  <X className="size-3.5" />
                </button>
              )}
              <ChevronsUpDown className="text-muted-foreground size-3.5" aria-hidden="true" />
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] p-1"
        >
          <div
            id={listboxId}
            role="listbox"
            aria-label={entityLabel}
            className="max-h-60 overflow-y-auto"
          >
            {isLoading && <p className="text-muted-foreground px-2 py-3 text-sm">Loading…</p>}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col gap-2 px-2 py-3">
                <p className="text-muted-foreground text-sm">No {entityLabel} found</p>
                {canCreate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => {
                      setCreateSession((n) => n + 1);
                      setCreateOpen(true);
                    }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add New {entityLabel}
                  </Button>
                )}
              </div>
            )}

            {!isLoading &&
              filtered.map((option, index) => (
                <button
                  key={option.id}
                  id={`${listboxId}-${option.id}`}
                  role="option"
                  type="button"
                  aria-selected={option.id === value}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    index === highlightedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted',
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      option.id === value ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden="true"
                  />
                  {option.name}
                </button>
              ))}
          </div>
        </PopoverContent>
      </Popover>

      {canCreate && (
        <CreateMasterDataDialog
          key={createSession}
          open={createOpen}
          onOpenChange={setCreateOpen}
          entityLabel={entityLabel}
          initialName={query}
          fields={createFields}
          options={options}
          isCreating={isCreating}
          createError={createError}
          onCreate={onCreate}
          onCreated={(created) => {
            setJustCreated(created);
            onChange(created.id);
            setQueryAndResetHighlight('');
            setCreateOpen(false);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CreateMasterDataDialog({
  open,
  onOpenChange,
  entityLabel,
  initialName,
  fields,
  options,
  isCreating,
  createError,
  onCreate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityLabel: string;
  initialName: string;
  fields: MasterDataCreateField[];
  options: MasterDataOption[];
  isCreating?: boolean;
  createError?: string;
  onCreate: (input: Record<string, string>) => Promise<MasterDataOption>;
  onCreated: (created: MasterDataOption) => void;
}) {
  // The parent remounts this component (via a `key` bumped on every open)
  // each time the dialog is opened, so these lazy initializers are enough
  // to seed fresh state per-open — no effect needed to "reset" them.
  const [values, setValues] = useState<Record<string, string>>(() => ({ name: initialName }));
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);

  const nameValue = values.name ?? '';
  const duplicate = useMemo(() => {
    const q = normalize(nameValue);
    if (!q) return undefined;
    return options.find((o) => normalize(o.matchName ?? o.name) === q);
  }, [options, nameValue]);

  const missingRequired = fields.some((f) => f.required && !values[f.key]?.trim());

  async function create() {
    const created = await onCreate(values);
    onCreated(created);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (missingRequired) return;
    if (duplicate && !confirmingDuplicate) {
      setConfirmingDuplicate(true);
      return;
    }
    void create();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New {entityLabel}</DialogTitle>
          <DialogDescription>
            This becomes available immediately and is selected on this shipment.
          </DialogDescription>
        </DialogHeader>

        {duplicate && confirmingDuplicate ? (
          <div className="flex flex-col gap-4">
            <div className="border-border bg-muted rounded-md border p-3">
              <p className="text-sm font-medium">Possible existing record</p>
              <p className="text-muted-foreground text-sm">{duplicate.name}</p>
            </div>
            <p className="text-sm">
              A {entityLabel.toLowerCase()} with a very similar name already exists. Use it instead,
              or create a new, separate record anyway.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmingDuplicate(false)}>
                Back
              </Button>
              <Button type="button" variant="outline" onClick={() => onCreated(duplicate)}>
                Use existing
              </Button>
              <Button type="button" disabled={isCreating} onClick={() => void create()}>
                {isCreating ? 'Creating…' : 'Create anyway'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                {/* The marker is a sibling, not a child, of <Label> — inside
                    it, `getByLabelText('Name')`-style exact matches break
                    (testing-library reads the label's raw textContent). */}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`create-${field.key}`}>{field.label}</Label>
                  {field.required && (
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  )}
                </div>
                <Input
                  id={`create-${field.key}`}
                  autoFocus={field.key === 'name'}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            {createError && <p className="text-destructive text-sm">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={missingRequired || isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Creating…
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
