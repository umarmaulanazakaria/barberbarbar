import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api, pesanError } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { rupiah } from "../lib/format";
import type { Barber, Layanan, Pelanggan } from "../types";
import { Button, Card, Label, SearchableSelect, Textarea } from "./ui";

type Row = {
  layananId: number;
  qty: number;
};

type NewOrderModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (orderId: number) => void;
};

const itemAwal = (): Row[] => [{ layananId: 0, qty: 1 }];

export default function NewOrderModal({
  open,
  onClose,
  onCreated,
}: NewOrderModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [customer, setCustomer] = useState(0);
  const [barber, setBarber] = useState(0);
  const [items, setItems] = useState<Row[]>(itemAwal);
  const [notes, setNotes] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get<Pelanggan[]>("/pelanggan")).data,
    enabled: open,
  });

  const { data: barbers = [] } = useQuery({
    queryKey: ["barbers"],
    queryFn: async () => (await api.get<Barber[]>("/barbers")).data,
    enabled: open,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.get<Layanan[]>("/layanan")).data,
    enabled: open,
  });

  const activeCustomers = customers.filter(
    (customerItem) => customerItem.status === "AKTIF",
  );
  const activeBarbers = barbers.filter((barberItem) => barberItem.aktif);
  const activeServices = services.filter((serviceItem) => serviceItem.aktif);

  const customerData = customers.find(
    (customerItem) => customerItem.id === customer,
  );

  const subtotal = useMemo(
    () =>
      items.reduce((jumlah, row) => {
        const service = services.find((item) => item.id === row.layananId);
        return jumlah + (service?.harga ?? 0) * row.qty;
      }, 0),
    [items, services],
  );

  const discount = customerData?.membership?.isActive
    ? customerData.membership.discountPercent
    : 0;
  const discountValue = Math.floor((subtotal * discount) / 100);
  const total = subtotal - discountValue;

  const resetForm = () => {
    setCustomer(0);
    setBarber(0);
    setItems(itemAwal());
    setNotes("");
  };

  const tutupModal = () => {
    if (mutation.isPending) return;
    resetForm();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/orders", {
          pelangganId: customer,
          barberId: barber,
          items: items.filter((item) => item.layananId),
          catatan: notes || undefined,
        })
      ).data,
    onSuccess: (data) => {
      toast.success("Order created successfully");
      queryClient.invalidateQueries({
        queryKey: ["orders"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });
      resetForm();
      onClose();
      if (onCreated) {
        onCreated(data.data.id);
      } else {
        navigate("/orders");
      }
    },
    onError: (error) => toast.error(pesanError(error)),
  });

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mutation.isPending) {
        resetForm();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, mutation.isPending, onClose]);

  if (!open) return null;

  const updateItem = (index: number, perubahan: Partial<Row>) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...perubahan } : item,
      ),
    );
  };

  const totalItems = items.reduce((jumlah, item) => jumlah + item.qty, 0);

  const totalDuration = items.reduce(
    (jumlah, row) =>
      jumlah +
      (services.find((item) => item.id === row.layananId)?.durasiMenit ?? 0) *
        row.qty,
    0,
  );

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-2 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          tutupModal();
        }
      }}
    >
      <Card className="modal-panel-enter max-h-[calc(100dvh-1rem)] w-full max-w-5xl overflow-hidden rounded-2xl border-slate-200 shadow-2xl sm:max-h-[94vh]">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">New Order</h2>
            <p className="mt-1 text-xs text-slate-500">
              Create order / customer check-in
            </p>
          </div>

          <button
            type="button"
            onClick={tutupModal}
            disabled={mutation.isPending}
            aria-label="Close new order"
            className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={19} />
          </button>
        </div>

        <form
          className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-4 sm:max-h-[calc(94vh-78px)] sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Customer *</Label>
              <SearchableSelect
                value={customer}
                onChange={(value) => setCustomer(Number(value))}
                placeholder="Select customer"
                searchPlaceholder="Search customer name or phone..."
                emptyText="Customer not found"
                ariaLabel="Select customer"
                options={activeCustomers.map((customerItem) => ({
                  value: customerItem.id,
                  label: `${customerItem.nama} — ${customerItem.nomorTelepon}${
                    customerItem.membership?.isActive
                      ? ` (Member ${customerItem.membership.discountPercent}%)`
                      : ""
                  }`,
                  searchText: `${customerItem.nama} ${customerItem.nomorTelepon}`,
                }))}
              />
            </div>

            <div>
              <Label>Barber *</Label>
              <SearchableSelect
                value={barber}
                onChange={(value) => setBarber(Number(value))}
                placeholder="Select barber"
                searchPlaceholder="Search barber..."
                emptyText="Barber not found"
                ariaLabel="Select barber"
                options={activeBarbers.map((barberItem) => ({
                  value: barberItem.id,
                  label: barberItem.nama,
                }))}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-xs font-bold text-slate-700">
              Service Items *
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[650px] text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3 text-left">Service</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                    <th aria-label="Action" />
                  </tr>
                </thead>

                <tbody>
                  {items.map((row, index) => {
                    const service = services.find(
                      (item) => item.id === row.layananId,
                    );

                    return (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="p-2">
                          <SearchableSelect
                            value={row.layananId}
                            onChange={(value) =>
                              updateItem(index, {
                                layananId: Number(value),
                              })
                            }
                            placeholder="Select service"
                            searchPlaceholder="Search service..."
                            emptyText="Service not found"
                            ariaLabel={`Select service item ${index + 1}`}
                            options={activeServices.map((serviceItem) => ({
                              value: serviceItem.id,
                              label: serviceItem.nama,
                              searchText: `${serviceItem.nama} ${serviceItem.durasiMenit} ${serviceItem.harga}`,
                            }))}
                          />
                        </td>
                        <td className="text-center">
                          {service?.durasiMenit ?? 0} min
                        </td>
                        <td className="text-center">
                          {rupiah(service?.harga ?? 0)}
                        </td>
                        <td>
                          <div className="mx-auto flex w-fit items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(index, {
                                  qty: Math.max(1, row.qty - 1),
                                })
                              }
                              className="rounded-md border border-slate-300 p-1 transition hover:bg-slate-100"
                            >
                              <Minus size={12} />
                            </button>
                            <b className="w-5 text-center">{row.qty}</b>
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(index, {
                                  qty: row.qty + 1,
                                })
                              }
                              className="rounded-md border border-slate-300 p-1 transition hover:bg-slate-100"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="text-center font-bold">
                          {rupiah((service?.harga ?? 0) * row.qty)}
                        </td>
                        <td className="px-3 text-center">
                          <button
                            type="button"
                            disabled={items.length === 1}
                            onClick={() =>
                              setItems((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                            aria-label="Remove service item"
                            className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-30"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() =>
                setItems((current) => [...current, { layananId: 0, qty: 1 }])
              }
            >
              + Add Service Item
            </Button>
          </div>

          <div className="mt-5">
            <Label>Notes (Optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Customer request..."
            />
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
            <div className="text-xs leading-6 text-slate-500">
              Total Items
              <b className="ml-2 text-slate-800">{totalItems}</b>
              <br />
              Total Duration
              <b className="ml-2 text-slate-800">{totalDuration} min</b>
            </div>

            <div className="space-y-1 text-right text-xs">
              <div>
                Subtotal <b>{rupiah(subtotal)}</b>
              </div>
              {discount > 0 && (
                <div className="text-emerald-600">
                  Member discount {discount}%
                  <b className="ml-1">-{rupiah(discountValue)}</b>
                </div>
              )}
              <div className="text-base font-black text-indigo-700">
                Total {rupiah(total)}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={resetForm}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                !customer ||
                !barber ||
                items.some((item) => !item.layananId) ||
                mutation.isPending
              }
            >
              {mutation.isPending ? "Saving..." : "Save Order"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
