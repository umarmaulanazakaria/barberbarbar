import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Minus,
  Plus,
  QrCode,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

import { api, pesanError } from "../lib/api";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "./ConfirmDialog";
import { rupiah } from "../lib/format";
import type { Layanan, MetodePembayaran, Pesanan } from "../types";
import {
  Button,
  Card,
  Input,
  Label,
  SearchableSelect,
  Textarea,
} from "./ui";

const methods = [
  ["CASH", "Cash", Banknote],
  ["QRIS", "QRIS", QrCode],
  ["CARD", "Card", CreditCard],
  ["TRANSFER", "Transfer", Landmark],
  ["OTHER", "Other", WalletCards],
] as const;

type PaymentModalProps = {
  order: Pesanan | null;
  open: boolean;
  onClose: () => void;
};

type ItemAction =
  | { tipe: "tambah"; layananId: number }
  | { tipe: "layanan"; itemId: number; layananId: number }
  | { tipe: "qty"; itemId: number; qty: number }
  | { tipe: "hapus"; itemId: number };

export default function PaymentModal({
  order,
  open,
  onClose,
}: PaymentModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [method, setMethod] = useState<MetodePembayaran>("CASH");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [newServiceId, setNewServiceId] = useState(0);

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.get<Layanan[]>("/layanan")).data,
    enabled: open && !paid,
  });

  useEffect(() => {
    if (!open || !order) return;

    setMethod("CASH");
    setAmount(order.total);
    setNotes("");
    setPaid(false);
    setNewServiceId(0);
  }, [open, order?.id]);

  useEffect(() => {
    if (!open || !order || paid) return;

    // Jika service berubah, nominal pembayaran ikut menyesuaikan total terbaru
    // tanpa mereset metode atau catatan yang sudah dipilih kasir.
    setAmount(order.total);
  }, [open, order?.id, order?.total, paid]);

  const refreshOrder = async () => {
    if (!order) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["order", order.id] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
  };

  const itemMutation = useMutation({
    mutationFn: async (action: ItemAction) => {
      if (!order) throw new Error("Order tidak tersedia");

      if (action.tipe === "tambah") {
        return api.post("/order-items", {
          pesananId: order.id,
          layananId: action.layananId,
          qty: 1,
        });
      }

      if (action.tipe === "layanan") {
        return api.patch(`/order-items/${action.itemId}`, {
          layananId: action.layananId,
        });
      }

      if (action.tipe === "qty") {
        return api.patch(`/order-items/${action.itemId}`, {
          qty: action.qty,
        });
      }

      return api.delete(`/order-items/${action.itemId}`);
    },
    onSuccess: async (_, action) => {
      await refreshOrder();

      if (action.tipe === "tambah") {
        setNewServiceId(0);
        toast.success("Service added to order");
      } else if (action.tipe === "hapus") {
        toast.success("Service removed from order");
      } else {
        toast.success("Order item updated");
      }
    },
    onError: (error) => toast.error(pesanError(error)),
  });

  const paymentMutation = useMutation({
    mutationFn: () => {
      if (!order) throw new Error("Order tidak tersedia");

      return api.post(`/orders/${order.id}/payment`, {
        metode: method,
        jumlahDiterima: amount,
        catatan: notes || undefined,
      });
    },
    onSuccess: async () => {
      if (!order) return;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", order.id] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["history"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);

      setPaid(true);
      setConfirmPayment(false);
      toast.success("Payment completed successfully");
    },
    onError: (error) => {
      setConfirmPayment(false);
      toast.error(pesanError(error));
    },
  });

  const busy = itemMutation.isPending || paymentMutation.isPending;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, busy, onClose]);

  const addOptions = useMemo(() => {
    if (!order) return [];

    return services.map((service) => ({
      value: service.id,
      label: `${service.nama} — ${rupiah(service.harga)}`,
      searchText: `${service.nama} ${service.durasiMenit} ${service.harga}`,
      disabled:
        !service.aktif ||
        order.items.some((item) => item.layananId === service.id),
    }));
  }, [order, services]);

  if (!open || !order) return null;

  const editable =
    order.statusPembayaran === "UNPAID" && order.status !== "CANCELLED";
  const change = Math.max(0, amount - order.total);

  const itemOptions = (itemId: number) =>
    services.map((service) => ({
      value: service.id,
      label: `${service.nama} — ${rupiah(service.harga)}`,
      searchText: `${service.nama} ${service.durasiMenit} ${service.harga}`,
      disabled:
        !service.aktif ||
        order.items.some(
          (item) => item.id !== itemId && item.layananId === service.id,
        ),
    }));

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-2 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <Card className="modal-panel-enter max-h-[calc(100dvh-1rem)] w-full max-w-5xl overflow-hidden rounded-2xl border-slate-200 shadow-2xl sm:max-h-[94vh]">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Payment</h2>
            <p className="mt-1 text-xs text-slate-500">
              Review and adjust services before paying {order.nomorPesanan}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close payment"
            className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={19} />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto sm:max-h-[calc(94vh-78px)]">
          {paid ? (
            <div className="grid min-h-[420px] place-items-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={34} />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Payment successful
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {order.nomorPesanan} has been marked as paid. You will stay on
                  the current page.
                </p>
                <Button className="mt-6 min-w-36" onClick={onClose}>
                  Back to Order Detail
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
              <div className="border-b p-4 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      Order Services
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Add, change, or remove services before payment is confirmed.
                    </div>
                  </div>
                  <div className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    Editable until paid
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-600">
                    Add Service
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <SearchableSelect
                      value={newServiceId}
                      onChange={(value) => setNewServiceId(Number(value))}
                      options={addOptions}
                      placeholder={
                        servicesLoading ? "Loading services..." : "Select service"
                      }
                      searchPlaceholder="Search service..."
                      emptyText="No available service"
                      disabled={!editable || busy || servicesLoading}
                    />
                    <Button
                      type="button"
                      disabled={!newServiceId || !editable || busy}
                      onClick={() =>
                        itemMutation.mutate({
                          tipe: "tambah",
                          layananId: newServiceId,
                        })
                      }
                    >
                      <Plus size={16} />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="mb-4">
                  <b>{order.pelanggan.nama}</b>
                  <div className="text-xs text-slate-400">
                    {order.pelanggan.nomorTelepon}
                  </div>
                </div>

                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                        <SearchableSelect
                          value={item.layananId}
                          onChange={(value) =>
                            itemMutation.mutate({
                              tipe: "layanan",
                              itemId: item.id,
                              layananId: Number(value),
                            })
                          }
                          options={itemOptions(item.id)}
                          placeholder={item.namaLayanan}
                          searchPlaceholder="Search service..."
                          disabled={!editable || busy}
                        />

                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              aria-label={`Decrease ${item.namaLayanan} quantity`}
                              disabled={!editable || busy || item.qty <= 1}
                              onClick={() =>
                                itemMutation.mutate({
                                  tipe: "qty",
                                  itemId: item.id,
                                  qty: item.qty - 1,
                                })
                              }
                              className="grid size-9 place-items-center rounded-l-lg text-slate-500 transition hover:bg-white hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <Minus size={14} />
                            </button>
                            <div className="min-w-9 text-center text-sm font-bold text-slate-800">
                              {item.qty}
                            </div>
                            <button
                              type="button"
                              aria-label={`Increase ${item.namaLayanan} quantity`}
                              disabled={!editable || busy || item.qty >= 20}
                              onClick={() =>
                                itemMutation.mutate({
                                  tipe: "qty",
                                  itemId: item.id,
                                  qty: item.qty + 1,
                                })
                              }
                              className="grid size-9 place-items-center rounded-r-lg text-slate-500 transition hover:bg-white hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${item.namaLayanan}`}
                            title={
                              order.items.length <= 1
                                ? "Order must have at least one service"
                                : "Remove service"
                            }
                            disabled={
                              !editable || busy || order.items.length <= 1
                            }
                            onClick={() =>
                              itemMutation.mutate({
                                tipe: "hapus",
                                itemId: item.id,
                              })
                            }
                            className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-slate-500">
                        <span>
                          {item.durasiMenit * item.qty} min · {rupiah(item.harga)} each
                        </span>
                        <b className="text-slate-800">{rupiah(item.subtotal)}</b>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <b>{rupiah(order.subtotal)}</b>
                  </div>

                  {order.diskon > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Member Discount ({order.discountPercent}%)</span>
                      <b>-{rupiah(order.diskon)}</b>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black text-indigo-700">
                    <span>TOTAL</span>
                    <span>{rupiah(order.total)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <Label>Payment Method</Label>
                <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {methods.map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMethod(value)}
                      disabled={busy}
                      className={`rounded-lg border p-3 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        method === value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-600 shadow-sm"
                          : "border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40"
                      }`}
                    >
                      <Icon className="mx-auto mb-1" size={17} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mb-4">
                  <Label>Amount Received</Label>
                  <Input
                    type="number"
                    min={0}
                    value={amount || ""}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    placeholder={String(order.total)}
                    disabled={busy}
                  />
                </div>

                <div className="mb-4 rounded-lg bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-600">Change</div>
                  <div className="text-xl font-black text-emerald-700">
                    {rupiah(change)}
                  </div>
                </div>

                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={busy}
                  />
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={onClose}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="success"
                    className="flex-1"
                    disabled={amount < order.total || busy}
                    onClick={() => setConfirmPayment(true)}
                  >
                    {paymentMutation.isPending ? "Processing..." : "Mark as Paid"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmPayment}
        title="Confirm Payment?"
        description={`Mark ${order.nomorPesanan} as paid with ${method}? After payment, order services can no longer be changed.`}
        confirmLabel="Mark as Paid"
        variant="success"
        loading={paymentMutation.isPending}
        onCancel={() => setConfirmPayment(false)}
        onConfirm={() => paymentMutation.mutate()}
      />
    </div>
  );
}
