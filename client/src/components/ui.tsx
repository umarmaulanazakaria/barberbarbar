import { statusRamah } from '../lib/teks';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type LabelHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, CircleDashed } from "lucide-react";

export const cn = (...v: Array<string | false | null | undefined>) =>
  v.filter(Boolean).join(" ");

export function SectionHeader({title,description,action}:{title:string;description?:string;action?:ReactNode}) {
  return <header className="section-header"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>;
}
export function ContentPanel({title,description,action,children,className=""}:{title:string;description?:string;action?:ReactNode;children:ReactNode;className?:string}) {
  return <Card className={`content-panel ${className}`}><SectionHeader title={title} description={description} action={action}/>{children}</Card>;
}

export function StatCard({label,value,icon,catatan}:{label:string;value:ReactNode;icon:ReactNode;catatan?:string}) {
  return <Card className="ui-stat"><div className="stat-top"><span>{label}</span><span className="stat-icon" aria-hidden="true">{icon}</span></div><strong className="stat-value">{value}</strong>{catatan&&<p className="stat-note">{catatan}</p>}</Card>;
}

export const Button = ({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
}) => (
  <button
    className={cn(
      `ui-button ui-button-${variant}`,
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
      variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-700",
      variant === "secondary" &&
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      variant === "danger" && "bg-red-50 text-red-600 hover:bg-red-100",
      variant === "success" && "bg-emerald-600 text-white hover:bg-emerald-700",
      variant === "ghost" && "text-slate-600 hover:bg-slate-100",
      className,
    )}
    {...props}
  />
);

export const Card = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {ref?: import("react").Ref<HTMLDivElement>}) => (
  <div
    className={cn(
      "ui-card rounded-xl border border-slate-200 bg-white shadow-sm",
      className,
    )}
    {...props}
  />
);

export const Input = ({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "ui-input min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
      className,
    )}
    {...props}
  />
);

export const Select = ({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "ui-input min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
      className,
    )}
    {...props}
  />
);

type SearchableValue = string | number;

export type SearchableOption = {
  value: SearchableValue;
  label: string;
  searchText?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  id?: string;
  value: SearchableValue;
  onChange: (value: SearchableValue) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada data yang sesuai",
  className = "",
  disabled = false,
  ariaLabel,
  id,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 300,
    placement: "bottom" as "bottom" | "top",
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  const filteredOptions = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("id-ID");
    if (!keyword) return options;

    return options.filter((option) =>
      `${option.label} ${option.searchText ?? ""}`
        .toLocaleLowerCase("id-ID")
        .includes(keyword),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const placement =
        spaceBelow >= 220 || spaceBelow >= spaceAbove ? "bottom" : "top";
      const availableSpace = placement === "bottom" ? spaceBelow : spaceAbove;

      const viewportPadding = 8;
      const width = Math.min(
        rect.width,
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      );

      setPosition({
        left,
        top: placement === "bottom" ? rect.bottom + 6 : rect.top - 6,
        width,
        maxHeight: Math.max(170, Math.min(320, availableSpace)),
        placement,
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    updatePosition();
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          role="listbox"
          className="fixed z-[200] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.maxHeight,
            transform:
              position.placement === "top" ? "translateY(-100%)" : undefined,
          }}
        >
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 transition focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                  if (event.key === "Enter" && filteredOptions.length === 1) {
                    event.preventDefault();
                    const onlyOption = filteredOptions[0];
                    if (onlyOption && !onlyOption.disabled) {
                      onChange(onlyOption.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }
                  }
                }}
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div
            className="overflow-y-auto p-1.5"
            style={{ maxHeight: Math.max(110, position.maxHeight - 58) }}
          >
            {!filteredOptions.length ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const active = String(option.value) === String(value);
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                      active
                        ? "bg-indigo-50 font-semibold text-indigo-700"
                        : "text-slate-700 hover:bg-slate-50",
                      option.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {active && <Check size={16} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (
            event.key === "ArrowDown" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
          open && "border-indigo-400 ring-2 ring-indigo-100",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected ? "text-slate-900" : "text-slate-500",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180 text-indigo-500",
          )}
        />
      </button>
      {panel}
    </div>
  );
};

export const Textarea = ({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "ui-input w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
      className,
    )}
    {...props}
  />
);

export const Label = ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label {...props} className="ui-label mb-1.5 block text-xs font-semibold text-slate-700">
    {children}
  </label>
);

export const Modal = ({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const sebelumnya=document.activeElement instanceof HTMLElement?document.activeElement:null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";(panel.current?.querySelector<HTMLElement>('.ui-modal-content')?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[role=combobox]') ?? panel.current?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus();return()=>{document.body.style.overflow=overflow;if(sebelumnya?.isConnected)sebelumnya.focus();};},[open]);
  return open ? (
    <div className="modal-backdrop-enter fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-2 backdrop-blur-[2px] sm:place-items-center sm:p-4">
      <Card ref={panel} onKeyDown={event=>{if(!(event.target instanceof Node)||!panel.current?.contains(event.target))return;if(event.key==="Escape"){event.preventDefault();onClose();}if(event.key==="Tab"){const daftar=Array.from(panel.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(e=>e.getClientRects().length);const awal=daftar[0],akhir=daftar.at(-1);if(event.shiftKey&&document.activeElement===awal){event.preventDefault();akhir?.focus();}else if(!event.shiftKey&&document.activeElement===akhir){event.preventDefault();awal?.focus();}}}} role="dialog" aria-modal="true" aria-label={title} className="modal-panel-enter max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl sm:max-h-[92vh]">
        <div className="ui-modal-header sticky top-0 z-10 flex items-center justify-between border-b">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="grid size-9 place-items-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <div className="ui-modal-content max-h-[calc(100dvh-5.5rem)] overflow-y-auto sm:max-h-[calc(92vh-69px)]">
          {children}
        </div>
      </Card>
    </div>
  ) : null;
};

export const StatusBadge = ({ value, label: labelKustom }: { value: string; label?: string }) => {
  const cls =
    value === "WAITING" || value === "PENDING_CONFIRMATION" || value === "PENDING_APPROVAL"
      ? "bg-indigo-50 text-indigo-600"
      : value === "IN_SERVICE" || value === "PROCESSING" || value === "PENDING"
        ? "bg-amber-50 text-amber-600"
        : value === "COMPLETED" || value === "PAID" || value === "AKTIF" || value === "SUCCEEDED" || value === "CONFIRMED" || value === "CHECKED_IN" || value === "DP_PAID"
          ? "bg-emerald-50 text-emerald-600"
          : value === "UNPAID" || value === "DIBLOKIR" || value === "OVERDUE" || value === "REJECTED" || value === "FAILED" || value === "NO_SHOW"
            ? "bg-red-50 text-red-600"
            : value === "INACTIVE"
              ? "bg-slate-100 text-slate-500"
              : "bg-slate-100 text-slate-600";
  const label = labelKustom ?? statusRamah(value);
  return (
    <span
      className={cn(
        "ui-status inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
        cls,
      )}
    >
      {label}
    </span>
  );
};

export const PageTitle = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="ui-page-header">
    <div>
      <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {action && (
      <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
        {action}
      </div>
    )}
  </div>
);

export const Empty = ({ text = "Belum ada data" }: { text?: string }) => (
  <div className="ui-empty" role="status"><CircleDashed size={30}/><p>{text}</p></div>
);

export const LoadingState = ({text="Memuat data..."}:{text?:string}) => <div className="ui-loading" role="status"><span className="ui-skeleton"/><span className="ui-skeleton"/><p>{text}</p></div>;

export const ErrorState = ({
  text = "Data belum dapat dimuat.",
  onRetry,
}: {
  text?: string;
  onRetry?: () => void;
}) => (
  <div role="alert" className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
    <div className="text-sm font-bold text-slate-700">{text}</div>
    <div className="mt-1 text-xs text-slate-400">
      Periksa koneksi dan coba lagi.
    </div>
    {onRetry && (
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Coba Lagi
      </Button>
    )}
  </div>
);

// Alias presentasi; kontrak komponen existing tetap kompatibel.
export {PageTitle as PageHeader, Empty as EmptyState};
