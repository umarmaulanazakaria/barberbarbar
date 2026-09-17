import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  History,
  LayoutDashboard,
  Menu,
  Scissors,
  Settings,
  Users,
  UserRound,
  ReceiptText,
  Tags,
  LogOut,
  X,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const menu = [
  ["Dashboard", "/", LayoutDashboard],
  ["Orders", "/orders", CalendarDays],
  ["Customers", "/customers", Users],
  ["Membership", "/membership", Tags],
  ["Barbers", "/barbers", UserRound],
  ["Services", "/services", Scissors],
  ["Order History", "/history", History],
  ["Invoices", "/invoices", ReceiptText],
  ["Reports", "/reports", ChartNoAxesCombined],
  ["Settings", "/settings", Settings],
] as const;

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="no-print fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-[86vw] max-w-72 bg-gradient-to-b from-[#101a3a] to-[#081126] text-white shadow-2xl transition-transform duration-200 lg:w-60 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-4">
          <img
            src="/barber-barbar-icon.png"
            alt="Barber Barbar"
            className="size-12 shrink-0 object-contain"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[17px] font-black tracking-tight">
              Barber Barbar
            </div>
            <div className="mt-1 truncate text-[9px] font-medium tracking-wide text-slate-300">
              Not Cutting Heads, Just Hair
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto grid size-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="scrollbar-thin h-[calc(100dvh-160px)] overflow-y-auto p-3">
          {menu.map(([label, to, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/30"
                    : "text-slate-300 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={16} />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold">{user?.name}</div>
              <div className="text-[10px] text-slate-400">{user?.role}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-4 lg:px-7">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mr-3 grid size-10 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <img
              src="/barber-barbar-icon.png"
              alt=""
              className="size-8 shrink-0 object-contain"
            />
            <div className="truncate text-sm font-black text-slate-900">
              Barber Barbar
            </div>
          </div>

          <div className="ml-auto min-w-0 text-right">
            <div className="max-w-36 truncate text-xs font-bold text-slate-800 sm:max-w-none">
              {user?.name}
            </div>
            <div className="hidden text-[10px] text-slate-400 sm:block">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </header>
        <main className="p-3 sm:p-4 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
