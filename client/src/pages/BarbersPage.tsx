import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, pesanError } from "../lib/api";
import type { Barber } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
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

export default function BarbersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["barbers"],
    queryFn: async () => (await api.get<Barber[]>("/barbers")).data,
  });

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Barber | null>(null);
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [aktif, setAktif] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredBarbers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    return data.filter((barber) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && barber.aktif) ||
        (statusFilter === "INACTIVE" && !barber.aktif);

      if (!matchesStatus) return false;
      if (!keyword) return true;

      return [
        barber.nama,
        barber.nomorTelepon ?? "",
        barber.aktif ? "active" : "inactive",
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [data, search, statusFilter]);

  const start = (barber?: Barber) => {
    setEdit(barber ?? null);
    setNama(barber?.nama ?? "");
    setPhone(barber?.nomorTelepon ?? "");
    setAktif(barber?.aktif ?? true);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () =>
      edit
        ? api.patch(`/barbers/${edit.id}`, {
            nama,
            nomorTelepon: phone || undefined,
            aktif,
          })
        : api.post("/barbers", {
            nama,
            nomorTelepon: phone || undefined,
            aktif,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["barbers"] });
      toast.success(
        edit ? "Barber updated successfully" : "Barber created successfully",
      );
      setOpen(false);
    },
    onError: (error) => toast.error(pesanError(error)),
  });

  const deleteBarber = async () => {
    if (!edit || !canManage) return;

    setDeletePending(true);
    try {
      await api.delete(`/barbers/${edit.id}`);
      await queryClient.invalidateQueries({ queryKey: ["barbers"] });
      toast.success("Barber deleted successfully");
      setConfirmDelete(false);
      setOpen(false);
    } catch (error) {
      toast.error(pesanError(error));
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Barbers"
        subtitle="Manage barber staff"
        action={
          canManage ? (
            <Button onClick={() => start()}>+ New Barber</Button>
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
              placeholder="Search barber name or phone..."
              className="pl-9"
            />
          </div>
          <SearchableSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(String(value))}
            placeholder="Filter status"
            searchPlaceholder="Search status..."
            ariaLabel="Filter barber status"
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading barbers..." />
          ) : isError ? (
            <ErrorState
              text="Failed to load barbers."
              onRetry={() => void refetch()}
            />
          ) : !filteredBarbers.length ? (
            <Empty
              text={
                search || statusFilter !== "ALL"
                  ? "No barbers match your filters"
                  : "No barbers yet"
              }
            />
          ) : (
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBarbers.map((barber) => (
                  <tr
                    key={barber.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => start(barber)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        start(barber);
                      }
                    }}
                    className="group cursor-pointer border-t border-slate-200 transition-all duration-200 hover:bg-indigo-50/60 hover:shadow-[inset_3px_0_0_0_#4f46e5] focus:bg-indigo-50/60 focus:outline-none focus:shadow-[inset_3px_0_0_0_#4f46e5]"
                  >
                    <td className="px-4 py-3 font-bold transition-transform duration-200 group-hover:translate-x-1">
                      {barber.nama}
                    </td>
                    <td>{barber.nomorTelepon ?? "-"}</td>
                    <td>
                      <StatusBadge
                        value={barber.aktif ? "AKTIF" : "INACTIVE"}
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
          edit ? (canManage ? "Edit Barber" : "Barber Details") : "New Barber"
        }
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              disabled={!canManage}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={!canManage}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(event) => setAktif(event.target.checked)}
              disabled={!canManage}
            />
            Active
          </label>

          {canManage && (
            <Button
              className="w-full"
              onClick={() => save.mutate()}
              disabled={!nama || save.isPending}
            >
              {save.isPending ? "Saving..." : "Save Barber"}
            </Button>
          )}

          {edit && canManage && (
            <div className="border-t border-slate-200 pt-4">
              <Button
                variant="danger"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
                disabled={deletePending}
              >
                Delete Barber
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Barber?"
        description="This barber can only be deleted if they do not have any order history."
        confirmLabel="Delete Barber"
        loading={deletePending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteBarber}
      />
    </>
  );
}
