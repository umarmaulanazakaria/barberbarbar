import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, pesanError } from "../lib/api";
import type { Layanan } from "../types";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog";
import { rupiah } from "../lib/format";
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

export default function ServicesPage() {
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
    queryKey: ["services"],
    queryFn: async () => (await api.get<Layanan[]>("/layanan")).data,
  });

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Layanan | null>(null);
  const [nama, setNama] = useState("");
  const [durasi, setDurasi] = useState(30);
  const [harga, setHarga] = useState(35000);
  const [aktif, setAktif] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredServices = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    return data.filter((service) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && service.aktif) ||
        (statusFilter === "INACTIVE" && !service.aktif);

      if (!matchesStatus) return false;
      if (!keyword) return true;

      return [
        service.nama,
        service.durasiMenit,
        service.harga,
        service.aktif ? "active" : "inactive",
      ]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(keyword);
    });
  }, [data, search, statusFilter]);

  const start = (service?: Layanan) => {
    setEdit(service ?? null);
    setNama(service?.nama ?? "");
    setDurasi(service?.durasiMenit ?? 30);
    setHarga(service?.harga ?? 35000);
    setAktif(service?.aktif ?? true);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: () =>
      edit
        ? api.patch(`/layanan/${edit.id}`, { nama, durasiMenit: durasi, harga, aktif })
        : api.post("/layanan", { nama, durasiMenit: durasi, harga, aktif }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(edit ? "Service updated successfully" : "Service created successfully");
      setOpen(false);
    },
    onError: (error) => toast.error(pesanError(error)),
  });

  const deleteService = async () => {
    if (!edit || !canManage) return;

    setDeletePending(true);
    try {
      await api.delete(`/layanan/${edit.id}`);
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success("Service deleted successfully");
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
        title="Services"
        subtitle="Service duration and pricing"
        action={canManage ? <Button onClick={() => start()}>+ New Service</Button> : undefined}
      />

      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search service name, duration, price..."
              className="pl-9"
            />
          </div>
          <SearchableSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(String(value))}
            placeholder="Filter status"
            searchPlaceholder="Search status..."
            ariaLabel="Filter service status"
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingState text="Loading services..." />
          ) : isError ? (
            <ErrorState text="Failed to load services." onRetry={() => void refetch()} />
          ) : !filteredServices.length ? (
            <Empty text={search || statusFilter !== "ALL" ? "No services match your filters" : "No services yet"} />
          ) : (
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Service</th>
                  <th>Duration</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((service) => (
                  <tr
                    key={service.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => start(service)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        start(service);
                      }
                    }}
                    className="group cursor-pointer border-t border-slate-200 transition-all duration-200 hover:bg-indigo-50/60 hover:shadow-[inset_3px_0_0_0_#4f46e5] focus:bg-indigo-50/60 focus:outline-none focus:shadow-[inset_3px_0_0_0_#4f46e5]"
                  >
                    <td className="px-4 py-3 font-bold transition-transform duration-200 group-hover:translate-x-1">{service.nama}</td>
                    <td>{service.durasiMenit} min</td>
                    <td>{rupiah(service.harga)}</td>
                    <td><StatusBadge value={service.aktif ? "AKTIF" : "INACTIVE"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        title={edit ? (canManage ? "Edit Service" : "Service Details") : "New Service"}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label>Service Name</Label>
            <Input value={nama} onChange={(event) => setNama(event.target.value)} disabled={!canManage} />
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" min={1} value={durasi} onChange={(event) => setDurasi(Number(event.target.value))} disabled={!canManage} />
          </div>
          <div>
            <Label>Price</Label>
            <Input type="number" min={1} value={harga} onChange={(event) => setHarga(Number(event.target.value))} disabled={!canManage} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={aktif} onChange={(event) => setAktif(event.target.checked)} disabled={!canManage} />
            Active
          </label>

          {canManage && (
            <Button className="w-full" onClick={() => save.mutate()} disabled={!nama || durasi <= 0 || harga <= 0 || save.isPending}>
              {save.isPending ? "Saving..." : "Save Service"}
            </Button>
          )}

          {edit && canManage && (
            <div className="border-t border-slate-200 pt-4">
              <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)} disabled={deletePending}>
                Delete Service
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Service?"
        description="This service can only be deleted if it has not been used in an order."
        confirmLabel="Delete Service"
        loading={deletePending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteService}
      />
    </>
  );
}
