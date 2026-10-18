import { useState } from "react";
import PengaturanOperasional from "../components/PengaturanOperasional";

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

      barber.pengguna ? "akun tersedia" : "belum memiliki akun",
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
        throw new Error("Konfirmasi kata sandi tidak sesuai");
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

      toast.success("Akun staf berhasil dibuat");

      closeModal();
    },

    onError: (error) => {
      toast.error(
        error instanceof Error &&
          error.message === "Konfirmasi kata sandi tidak sesuai"
          ? error.message
          : pesanError(error),
      );
    },
  });

  return (
    <>
      <PageTitle
        title="Pengaturan"
        subtitle="Informasi aplikasi dan akun"
      />

      <PengaturanOperasional/>
      <h2 id="pengaturan-akses" className="mb-4 font-bold">Akun &amp; Akses</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold">Akun yang Masuk</h3>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="text-slate-400">Nama</span>

              <div className="font-bold">{user?.name}</div>
            </div>

            <div>
              <span className="text-slate-400">Email</span>

              <div className="font-bold">{user?.email}</div>
            </div>

            <div>
              <span className="text-slate-400">Peran</span>

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
              <h3 className="font-black">Hak Akses</h3>

              <p className="text-xs font-medium text-slate-500">
                Otorisasi mengikuti akun operator
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-500">
            ADMIN mengelola akun staf dan harga paket Membership. STAFF tetap mengikuti hak operasional existing. Perubahan akun dan kata sandi tidak dilakukan melalui field konfigurasi pembayaran.
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
                <h3 className="font-bold text-slate-900">Akun Staf</h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Buat akun masuk staf dari data barber yang sudah tersedia.
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <Input aria-label="Cari nama barber, telepon, atau email akun..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama barber, telepon, atau email akun..."
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <LoadingState text="Memuat akun staf..." />
            ) : isError ? (
              <ErrorState
                text="Akun staf belum dapat dimuat."
                onRetry={() => void refetch()}
              />
            ) : !filteredBarbers.length ? (
              <Empty text="Belum ada data barber" />
            ) : (
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Barber</th>

                    <th>Telepon</th>

                    <th>Status Barber</th>

                    <th>Akun Masuk</th>

                    <th className="px-4 text-right">Tindakan</th>
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
                              Akun staf aktif
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">Belum dibuat</span>
                        )}
                      </td>

                      <td className="px-4 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => openCreateAccount(barber)}
                          disabled={!barber.aktif || Boolean(barber.pengguna)}
                        >
                          {barber.pengguna
                            ? "Akun Tersedia"
                            : "Buat Akun"}
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
        title="Buat Akun Staf"
        onClose={closeModal}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="text-xs font-semibold text-indigo-500">Barber</div>

            <div className="mt-1 font-black text-slate-900">
              {selectedBarber?.nama}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Nama akun mengikuti nama barber ini.
            </div>
          </div>

          <div>
            <Label htmlFor="bidang-settingspage-1">Email</Label>

            <Input  id="bidang-settingspage-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@example.com"
            />
          </div>

          <div>
            <Label htmlFor="bidang-settingspage-2">Kata Sandi</Label>

            <Input  id="bidang-settingspage-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>

          <div>
            <Label htmlFor="bidang-settingspage-3">Konfirmasi Kata Sandi</Label>

            <Input  id="bidang-settingspage-3"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ulangi kata sandi"
            />
          </div>

          {confirmPassword && password !== confirmPassword && <p role="alert" className="text-sm text-red-600">Konfirmasi kata sandi belum sesuai.</p>}
          <Button
            className="w-full"
            onClick={() => createAccount.mutate()}
            disabled={
              !email ||
              password.length < 6 ||
              confirmPassword.length < 6 ||
              password !== confirmPassword ||
              createAccount.isPending
            }
          >
            {createAccount.isPending ? "Membuat akun..." : "Buat Akun Staf"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
