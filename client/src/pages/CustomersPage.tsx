import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, pesanError } from "../lib/api";
import type { Pelanggan, Pesanan } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { rupiah, tanggal } from "../lib/format";
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

type ConfirmAction = "block" | "unblock" | "delete" | null;

export default function CustomersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get<Pelanggan[]>("/pelanggan")).data,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", "all"],
    queryFn: async () => (await api.get<Pesanan[]>("/orders")).data,
  });

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Pelanggan | null>(null);
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [alamat, setAlamat] = useState("");
  const [search, setSearch] = useState("");
  const [statusPending, setStatusPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");
    if (!keyword) return data;

    return data.filter((pelanggan) => {
      const membership = pelanggan.membership?.isActive
        ? `${pelanggan.membership.memberCode} ${pelanggan.membership.discountPercent}`
        : "";

      return [
        pelanggan.nama,
        pelanggan.nomorTelepon,
        pelanggan.alamat ?? "",
        pelanggan.status,
        membership,
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [data, search]);

  const customerHistory = useMemo(() => {
    if (!edit) return [];

    return orders
      .filter((order) => order.pelangganId === edit.id)
      .sort(
        (a, b) =>
          new Date(b.diperbaruiPada).getTime() -
          new Date(a.diperbaruiPada).getTime(),
      );
  }, [edit, orders]);

  const customerStats = useMemo(() => {
    const completed = customerHistory.filter(
      (order) => order.status === "COMPLETED",
    );
    const paid = completed.filter((order) => order.statusPembayaran === "PAID");

    return {
      visits: completed.length,
      spending: paid.reduce((sum, order) => sum + order.total, 0),
    };
  }, [customerHistory]);

  const save = useMutation({
    mutationFn: () =>
      edit
        ? api.patch(`/pelanggan/${edit.id}`, {
            nama,
            nomorTelepon: phone,
            alamat,
          })
        : api.post("/pelanggan", {
            nama,
            nomorTelepon: phone,
            alamat,
          }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(
        edit
          ? "Customer updated successfully"
          : "Customer created successfully",
      );
      setOpen(false);
    },
    onError: (error) => toast.error(pesanError(error)),
  });

  const start = (pelanggan?: Pelanggan) => {
    setEdit(pelanggan ?? null);
    setNama(pelanggan?.nama ?? "");
    setPhone(pelanggan?.nomorTelepon ?? "");
    setAlamat(pelanggan?.alamat ?? "");
    setOpen(true);
  };

  const refreshAndClose = async () => {
    await qc.invalidateQueries({ queryKey: ["customers"] });
    setOpen(false);
  };

  const executeStatusChange = async () => {
    if (!edit || (confirmAction !== "block" && confirmAction !== "unblock"))
      return;

    const unblock = confirmAction === "unblock";
    setStatusPending(true);
    try {
      await api.patch(
        `/pelanggan/${edit.id}/${unblock ? "buka-blokir" : "blokir"}`,
      );
      toast.success(
        unblock
          ? "Customer unblocked successfully"
          : "Customer blocked successfully",
      );
      setConfirmAction(null);
      await refreshAndClose();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setStatusPending(false);
    }
  };

  const executeDelete = async () => {
    if (!edit || user?.role !== "ADMIN") return;

    setDeletePending(true);
    try {
      await api.delete(`/pelanggan/${edit.id}`);
      toast.success("Customer deleted successfully");
      setConfirmAction(null);
      await refreshAndClose();
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setDeletePending(false);
    }
  };

  const confirmTitle =
    confirmAction === "delete"
      ? "Delete Customer?"
      : confirmAction === "unblock"
        ? "Unblock Customer?"
        : "Block Customer?";

  const confirmDescription =
    confirmAction === "delete"
      ? "This action cannot be undone. Customers with order history cannot be deleted."
      : confirmAction === "unblock"
        ? "This customer will be allowed to create new orders again."
        : "Blocked customers cannot create new orders until they are unblocked.";

  return (
    <>
      <PageTitle
        title="Customers"
        subtitle="Customer information and blocked customers"
        action={<Button onClick={() => start()}>+ New Customer</Button>}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, phone, address, membership..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading customers..." />
          ) : isError ? (
            <ErrorState
              text="Failed to load customers."
              onRetry={() => void refetch()}
            />
          ) : filteredCustomers.length === 0 ? (
            <Empty
              text={
                search ? "No customers match your search" : "No customers yet"
              }
            />
          ) : (
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Membership</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((pelanggan) => (
                  <tr
                    key={pelanggan.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => start(pelanggan)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        start(pelanggan);
                      }
                    }}
                    className="group cursor-pointer border-t border-slate-200 transition-all duration-200 hover:bg-indigo-50/60 hover:shadow-[inset_3px_0_0_0_#4f46e5] focus:bg-indigo-50/60 focus:outline-none focus:shadow-[inset_3px_0_0_0_#4f46e5]"
                  >
                    <td className="px-4 py-3 font-bold transition-transform duration-200 group-hover:translate-x-1">
                      {pelanggan.nama}
                    </td>
                    <td>{pelanggan.nomorTelepon}</td>
                    <td>{pelanggan.alamat ?? "-"}</td>
                    <td>
                      {pelanggan.membership?.isActive ? (
                        <span className="font-bold text-indigo-600">
                          {pelanggan.membership.memberCode} (
                          {pelanggan.membership.discountPercent}%)
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <StatusBadge value={pelanggan.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        title={edit ? "Edit Customer" : "New Customer"}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          {edit && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Total Visits
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {customerStats.visits}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Total Spending
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {rupiah(customerStats.spending)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 px-3 py-2.5">
                  <p className="text-xs font-black text-slate-800">
                    Visit History
                  </p>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {!customerHistory.length ? (
                    <p className="px-3 py-5 text-center text-xs text-slate-400">
                      No order history yet
                    </p>
                  ) : (
                    customerHistory.map((order) => (
                      <div
                        key={order.id}
                        className="border-b border-slate-100 px-3 py-3 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-indigo-600">
                              {order.nomorPesanan}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-700">
                              {order.items
                                .map(
                                  (item) =>
                                    `${item.namaLayanan}${item.qty > 1 ? ` x${item.qty}` : ""}`,
                                )
                                .join(", ")}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {tanggal(order.diperbaruiPada)} ·{" "}
                              {order.barber.nama}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-slate-900">
                              {rupiah(order.total)}
                            </p>
                            <p
                              className={`mt-1 text-[10px] font-bold ${order.statusPembayaran === "PAID" ? "text-emerald-600" : "text-amber-600"}`}
                            >
                              {order.statusPembayaran === "PAID"
                                ? "Paid"
                                : "Unpaid"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Name</Label>
            <Input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
            />
          </div>

          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={edit?.status === "DIBLOKIR"}
            />
            {edit?.status === "DIBLOKIR" && (
              <p className="mt-1.5 text-xs text-slate-500">
                Phone number cannot be changed while this customer is blocked.
              </p>
            )}
          </div>

          <div>
            <Label>Address</Label>
            <Input
              value={alamat}
              onChange={(event) => setAlamat(event.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!nama || !phone || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving..." : "Save Customer"}
          </Button>

          {edit && (
            <div className="border-t border-slate-200 pt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant={edit.status === "DIBLOKIR" ? "success" : "danger"}
                  disabled={statusPending}
                  onClick={() =>
                    setConfirmAction(
                      edit.status === "DIBLOKIR" ? "unblock" : "block",
                    )
                  }
                >
                  {edit.status === "DIBLOKIR"
                    ? "Unblock Customer"
                    : "Block Customer"}
                </Button>

                {user?.role === "ADMIN" && (
                  <Button
                    variant="danger"
                    disabled={deletePending}
                    onClick={() => setConfirmAction("delete")}
                  >
                    Delete Customer
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={
          confirmAction === "delete"
            ? "Delete Customer"
            : confirmAction === "unblock"
              ? "Unblock Customer"
              : "Block Customer"
        }
        variant={confirmAction === "unblock" ? "success" : "danger"}
        loading={statusPending || deletePending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={
          confirmAction === "delete" ? executeDelete : executeStatusChange
        }
      />
    </>
  );
}
