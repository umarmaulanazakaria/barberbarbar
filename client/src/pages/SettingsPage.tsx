import { useAuth } from "../context/AuthContext";
import { Card, PageTitle } from "../components/ui";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <PageTitle
        title="Settings"
        subtitle="Application and account information"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold">Signed-in Account</h3>
          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Name</span>
              <div className="font-bold">{user?.name}</div>
            </div>
            <div>
              <span className="text-slate-400">Email</span>
              <div className="font-bold">{user?.email}</div>
            </div>
            <div>
              <span className="text-slate-400">Role</span>
              <div className="font-bold text-indigo-600">{user?.role}</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <img
              src="/barber-barbar-icon.png"
              alt="Barber Barbar"
              className="size-12 object-contain"
            />
            <div>
              <h3 className="font-black">Barber Barbar</h3>
              <p className="text-xs font-medium text-slate-500">
                Not Cutting Heads, Just Hair
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Manage customers, barbers, services, orders, payments and reports in one place.
          </p>
        </Card>
      </div>
    </>
  );
}
