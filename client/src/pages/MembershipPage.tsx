import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Search } from "lucide-react";

import { api, pesanError } from "../lib/api";

import type { Membership, Pelanggan, Pesanan } from "../types";

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
  SearchableSelect,
  StatusBadge,
} from "../components/ui";

export default function MembershipPage() {
  const { user } = useAuth();

  const toast = useToast();

  const queryClient = useQueryClient();

  const canCreate = user?.role === "ADMIN" || user?.role === "STAFF";

  const canManage = user?.role === "ADMIN";

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["memberships"],

    queryFn: async () => (await api.get<Membership[]>("/memberships")).data,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],

    queryFn: async () => (await api.get<Pelanggan[]>("/pelanggan")).data,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", "all"],

    queryFn: async () => (await api.get<Pesanan[]>("/orders")).data,
  });

  const [open, setOpen] = useState(false);

  const [edit, setEdit] = useState<Membership | null>(null);

  const [customer, setCustomer] = useState(0);

  const [discount, setDiscount] = useState(10);

  const [active, setActive] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredMemberships = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    return data.filter((membership) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && membership.isActive) ||
        (statusFilter === "INACTIVE" && !membership.isActive);

      if (!matchesStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        membership.memberCode,

        membership.pelanggan?.nama ?? "",

        membership.pelanggan?.nomorTelepon ?? "",

        membership.discountPercent,

        membership.isActive ? "active" : "inactive",
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [data, search, statusFilter]);

  const selectedStats = useMemo(() => {
    if (!edit) {
      return null;
    }

    const customerOrders = orders.filter(
      (order) => order.pelangganId === edit.pelangganId,
    );

    const completedOrders = customerOrders.filter(
      (order) => order.status === "COMPLETED",
    );

    const paidOrders = completedOrders.filter(
      (order) => order.statusPembayaran === "PAID",
    );

    const lastVisit = [...completedOrders].sort(
      (a, b) =>
        new Date(b.diperbaruiPada).getTime() -
        new Date(a.diperbaruiPada).getTime(),
    )[0];

    return {
      totalVisits: completedOrders.length,

      totalSpending: paidOrders.reduce((sum, order) => sum + order.total, 0),

      lastVisit: lastVisit?.diperbaruiPada ?? null,
    };
  }, [edit, orders]);

  const start = (membership?: Membership) => {
    setEdit(membership ?? null);

    setCustomer(membership?.pelangganId ?? 0);

    setDiscount(membership?.discountPercent ?? 10);

    setActive(membership?.isActive ?? true);

    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (edit) {
        return (
          await api.patch<{
            data: Membership;
          }>(`/memberships/${edit.id}`, {
            discountPercent: discount,

            isActive: active,
          })
        ).data.data;
      }

      return (
        await api.post<{
          data: Membership;
        }>("/memberships", {
          pelangganId: customer,
        })
      ).data.data;
    },

    onSuccess: async (savedMembership) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["memberships"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["customers"],
        }),
      ]);

      toast.success(
        edit
          ? "Membership updated successfully"
          : `Membership ${savedMembership.memberCode} created successfully`,
      );

      setOpen(false);
    },

    onError: (error) => toast.error(pesanError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/memberships/${id}`);
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["memberships"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["customers"],
        }),
      ]);

      toast.success("Membership deleted successfully");

      setConfirmDelete(false);

      setOpen(false);
    },

    onError: (error) => toast.error(pesanError(error)),
  });

  return (
    <>
      <PageTitle
        title="Membership"
        subtitle="Membership codes and customer discounts"
        action={
          canCreate ? (
            <Button onClick={() => start()}>+ New Membership</Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search member code, customer, phone..."
              className="pl-9"
            />
          </div>

          <SearchableSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(String(value))}
            placeholder="Filter status"
            searchPlaceholder="Search status..."
            ariaLabel="Filter membership status"
            options={[
              {
                value: "ALL",
                label: "All statuses",
              },

              {
                value: "ACTIVE",

                label: "Active",
              },

              {
                value: "INACTIVE",

                label: "Inactive",
              },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading memberships..." />
          ) : isError ? (
            <ErrorState
              text="Failed to load memberships."
              onRetry={() => void refetch()}
            />
          ) : !filteredMemberships.length ? (
            <Empty
              text={
                search || statusFilter !== "ALL"
                  ? "No memberships match your filters"
                  : "No memberships yet"
              }
            />
          ) : (
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Member Code</th>

                  <th>Customer</th>

                  <th>Phone</th>

                  <th>Discount</th>

                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredMemberships.map((membership) => (
                  <tr
                    key={membership.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => start(membership)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();

                        start(membership);
                      }
                    }}
                    className="group cursor-pointer border-t border-slate-200 transition-all duration-200 hover:bg-indigo-50/60 hover:shadow-[inset_3px_0_0_0_#4f46e5] focus:bg-indigo-50/60 focus:outline-none focus:shadow-[inset_3px_0_0_0_#4f46e5]"
                  >
                    <td className="px-4 py-3 font-black text-indigo-600">
                      <span className="inline-flex transition-transform duration-200 group-hover:translate-x-1">
                        {membership.memberCode}
                      </span>
                    </td>

                    <td>{membership.pelanggan?.nama}</td>

                    <td>{membership.pelanggan?.nomorTelepon}</td>

                    <td>{membership.discountPercent}%</td>

                    <td>
                      <StatusBadge
                        value={membership.isActive ? "AKTIF" : "DIBLOKIR"}
                      />
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
        title={
          edit
            ? canManage
              ? "Edit Membership"
              : "Membership Details"
            : "New Membership"
        }
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          {edit && selectedStats && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Joined
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {tanggal(edit.joinedAt)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Total Visits
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {selectedStats.totalVisits}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Total Spending
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {rupiah(selectedStats.totalSpending)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Last Visit
                </p>

                <p className="mt-1 font-bold text-slate-900">
                  {selectedStats.lastVisit
                    ? tanggal(selectedStats.lastVisit)
                    : "No visit yet"}
                </p>
              </div>
            </div>
          )}

          {!edit && (
            <>
              <div>
                <Label>Customer</Label>

                <SearchableSelect
                  value={customer}
                  onChange={(value) => setCustomer(Number(value))}
                  placeholder="Select customer"
                  searchPlaceholder="Search customer name or phone..."
                  emptyText="Customer not found"
                  ariaLabel="Select membership customer"
                  options={customers
                    .filter(
                      (item) => item.status === "AKTIF" && !item.membership,
                    )
                    .map((item) => ({
                      value: item.id,

                      label: `${item.nama} — ${item.nomorTelepon}`,

                      searchText: `${item.nama} ${item.nomorTelepon}`,
                    }))}
                />
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-semibold text-indigo-600">
                  New Membership
                </p>

                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Discount</div>

                    <div className="font-bold text-slate-900">10%</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500">Status</div>

                    <div className="font-bold text-emerald-600">Active</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {edit && (
            <div>
              <Label>Customer</Label>

              <Input
                value={`${edit.pelanggan?.nama ?? "-"} — ${edit.pelanggan?.nomorTelepon ?? "-"}`}
                disabled
              />
            </div>
          )}

          {edit && (
            <div>
              <Label>Member Code</Label>

              <Input value={edit.memberCode} disabled />
            </div>
          )}

          {edit && (
            <div>
              <Label>Discount (%)</Label>

              <Input
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
                disabled={!canManage}
              />
            </div>
          )}

          {edit && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                disabled={!canManage}
              />
              Active
            </label>
          )}

          {!edit && canCreate && (
            <Button
              className="w-full"
              onClick={() => save.mutate()}
              disabled={!customer || save.isPending}
            >
              {save.isPending ? "Saving..." : "Create Membership"}
            </Button>
          )}

          {edit && canManage && (
            <Button
              className="w-full"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving..." : "Save Membership"}
            </Button>
          )}

          {edit && canManage && (
            <div className="border-t border-slate-200 pt-4">
              <Button
                variant="danger"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
                disabled={remove.isPending}
              >
                Delete Membership
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Membership?"
        description="The membership will be removed from this customer. This action cannot be undone."
        confirmLabel="Delete Membership"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => edit && remove.mutate(edit.id)}
      />
    </>
  );
}
