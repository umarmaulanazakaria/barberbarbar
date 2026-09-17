import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export const cn = (...v: Array<string | false | null | undefined>) =>
  v.filter(Boolean).join(" ");

export const Button = ({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
}) => (
  <button
    className={cn(
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
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-xl border border-slate-200 bg-white shadow-sm",
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
      "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
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
      "min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
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
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyText = "No matching data",
  className = "",
  disabled = false,
  ariaLabel,
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
      "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
      className,
    )}
    {...props}
  />
);

export const Label = ({ children }: { children: ReactNode }) => (
  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
}) =>
  open ? (
    <div className="modal-backdrop-enter fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-2 backdrop-blur-[2px] sm:place-items-center sm:p-4">
      <Card className="modal-panel-enter max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl sm:max-h-[92vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-4 sm:px-5">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="grid size-9 place-items-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-4 sm:max-h-[calc(92vh-69px)] sm:p-5">
          {children}
        </div>
      </Card>
    </div>
  ) : null;

export const StatusBadge = ({ value }: { value: string }) => {
  const cls =
    value === "WAITING"
      ? "bg-indigo-50 text-indigo-600"
      : value === "IN_SERVICE"
        ? "bg-amber-50 text-amber-600"
        : value === "COMPLETED" || value === "PAID" || value === "AKTIF"
          ? "bg-emerald-50 text-emerald-600"
          : value === "UNPAID" || value === "DIBLOKIR"
            ? "bg-red-50 text-red-600"
            : value === "INACTIVE"
              ? "bg-slate-100 text-slate-500"
              : "bg-slate-100 text-slate-600";
  const labels: Record<string, string> = {
    WAITING: "Waiting",
    IN_SERVICE: "In Service",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    UNPAID: "Unpaid",
    PAID: "Paid",
    AKTIF: "Active",
    DIBLOKIR: "Blocked",
    INACTIVE: "Inactive",
  };
  const label = labels[value] ?? value;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
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
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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

export const Empty = ({ text = "No data found" }: { text?: string }) => (
  <div className="py-12 text-center text-sm text-slate-400">{text}</div>
);

export const LoadingState = ({
  text = "Loading data...",
}: {
  text?: string;
}) => (
  <div className="flex min-h-40 items-center justify-center gap-3 px-6 py-10 text-sm font-semibold text-slate-500">
    <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
    {text}
  </div>
);

export const ErrorState = ({
  text = "Failed to load data.",
  onRetry,
}: {
  text?: string;
  onRetry?: () => void;
}) => (
  <div className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
    <div className="text-sm font-bold text-slate-700">{text}</div>
    <div className="mt-1 text-xs text-slate-400">
      Check the connection and try again.
    </div>
    {onRetry && (
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Try Again
      </Button>
    )}
  </div>
);
