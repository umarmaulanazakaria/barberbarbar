import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Search, UserRoundPlus } from "lucide-react";

import { useAuth } from "../context/AuthContext";

import { useToast } from "../context/ToastContext";

import { api, pesanError } from "../lib/api";

import type { BarberWithAccount } from "../types";

import {
  Button,
  Card,
  Empty,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Modal,
  PageTitle,
  StatusBadge,
} from "../components/ui";

export default function SettingsPage() {
  const { user } = useAuth();

  const toast = useToast();

  const queryClient = useQueryClient();

  const isAdmin = user?.role === "ADMIN";

  const [search, setSearch] = useState("");

  const [selectedBarber, setSelectedBarber] =
    useState<BarberWithAccount | null>(null);

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const {
    data: barbers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["barber-staff-accounts"],

    queryFn: async () =>
      (await api.get<BarberWithAccount[]>("/barbers/staff-accounts")).data,

    enabled: isAdmin,
  });

  const filteredBarbers = barbers.filter((barber) => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    if (!keyword) {
      return true;
    }

    return [
      barber.nama,

      barber.nomorTelepon ?? "",

      barber.pengguna?.email ?? "",

      barber.pengguna ? "account created" : "no account",
    ]
      .join(" ")
      .toLocaleLowerCase("id-ID")
      .includes(keyword);
  });

  const closeModal = () => {
    setSelectedBarber(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const openCreateAccount = (barber: BarberWithAccount) => {
    setSelectedBarber(barber);

    setEmail("");
    setPassword("");
    setConfirmPassword("");
  };

  const createAccount = useMutation({
    mutationFn: async () => {
      if (!selectedBarber) {
        throw new Error("Barber belum dipilih");
      }

      if (password !== confirmPassword) {
        throw new Error("Password confirmation does not match");
      }

      return api.post(`/barbers/${selectedBarber.id}/account`, {
        email,
        password,
        confirmPassword,
      });
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["barber-staff-accounts"],
      });

      toast.success("Staff account created successfully");

      closeModal();
    },

    onError: (error) => {
      toast.error(
        error instanceof Error &&
          error.message === "Password confirmation does not match"
          ? error.message
          : pesanError(error),
      );
    },
  });

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
            Manage customers, barbers, services, orders, payments and reports in
            one place.
          </p>
        </Card>
      </div>

      {isAdmin && (
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <UserRoundPlus size={19} />
              </div>

              <div>
                <h3 className="font-bold text-slate-900">Staff Accounts</h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Create STAFF login accounts from existing barber data.
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search barber name, phone or account email..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <LoadingState text="Loading staff accounts..." />
            ) : isError ? (
              <ErrorState
                text="Failed to load staff accounts."
                onRetry={() => void refetch()}
              />
            ) : !filteredBarbers.length ? (
              <Empty text="No barber data found" />
            ) : (
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Barber</th>

                    <th>Phone</th>

                    <th>Barber Status</th>

                    <th>Login Account</th>

                    <th className="px-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBarbers.map((barber) => (
                    <tr key={barber.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {barber.nama}
                      </td>

                      <td>{barber.nomorTelepon ?? "-"}</td>

                      <td>
                        <StatusBadge
                          value={barber.aktif ? "AKTIF" : "INACTIVE"}
                        />
                      </td>

                      <td>
                        {barber.pengguna ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {barber.pengguna.email}
                            </div>

                            <div className="mt-0.5 text-[11px] text-emerald-600">
                              Staff account active
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Not created</span>
                        )}
                      </td>

                      <td className="px-4 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => openCreateAccount(barber)}
                          disabled={!barber.aktif || Boolean(barber.pengguna)}
                        >
                          {barber.pengguna
                            ? "Account Created"
                            : "Create Account"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(selectedBarber)}
        title="Create Staff Account"
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="text-xs font-semibold text-indigo-500">Barber</div>

            <div className="mt-1 font-black text-slate-900">
              {selectedBarber?.nama}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              The account name will use this barber name automatically.
            </div>
          </div>

          <div>
            <Label>Email</Label>

            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@barber.com"
            />
          </div>

          <div>
            <Label>Password</Label>

            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>

          <div>
            <Label>Confirm Password</Label>

            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => createAccount.mutate()}
            disabled={
              !email ||
              password.length < 6 ||
              confirmPassword.length < 6 ||
              createAccount.isPending
            }
          >
            {createAccount.isPending ? "Creating..." : "Create Staff Account"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
