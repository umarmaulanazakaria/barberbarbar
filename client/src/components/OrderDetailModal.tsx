import { statusRamah } from '../lib/teks';
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Printer, X } from "lucide-react";

import { api, pesanError } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { rupiah, tanggal, waktu } from "../lib/format";
import type { Pesanan, StatusPesanan } from "../types";
import { Button, Card, ErrorState, LoadingState, StatusBadge } from "./ui";
import PaymentModal from "./PaymentModal";
import { Link } from "react-router-dom";

type OrderDetailModalProps = {
  orderId: number | null;
  onClose: () => void;
};

type PrintMode = "ticket" | "invoice" | null;

export default function OrderDetailModal({
  orderId,
  onClose,
}: OrderDetailModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>(null);
  const open = orderId !== null;

  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => (await api.get<Pesanan>(`/orders/${orderId}`)).data,
    enabled: open,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: StatusPesanan) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: (_, status) => {
      toast.success(
        status === "IN_SERVICE"
          ? "Layanan dimulai"
          : "Layanan pesanan selesai",
      );
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(pesanError(error)),
  });

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !statusMutation.isPending && !paymentOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, paymentOpen, statusMutation.isPending]);

  useEffect(() => {
    const resetPrintMode = () => setPrintMode(null);
    window.addEventListener("afterprint", resetPrintMode);
    return () => window.removeEventListener("afterprint", resetPrintMode);
  }, []);

  if (!open) return null;

  const duration =
    order?.items.reduce(
      (total, item) => total + item.durasiMenit * item.qty,
      0,
    ) ?? 0;

  const printDocument = (mode: Exclude<PrintMode, null>) => {
    setPrintMode(mode);
    window.setTimeout(() => window.print(), 80);
  };

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-2 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !statusMutation.isPending &&
          !paymentOpen
        ) {
          onClose();
        }
      }}
    >
      <Card className="modal-panel-enter max-h-[calc(100dvh-1rem)] w-full max-w-6xl overflow-hidden rounded-2xl border-slate-200 shadow-2xl sm:max-h-[94vh]">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
              Detail Pesanan
            </h2>
            <p className="mt-1 truncate text-xs text-slate-500">
              {order?.nomorPesanan ?? "Memuat pesanan..."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={statusMutation.isPending || paymentOpen}
            aria-label="Tutup detail pesanan"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={19} />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto p-4 sm:max-h-[calc(94vh-78px)] sm:p-6">
          {isLoading ? (
            <LoadingState text="Memuat detail pesanan..." />
          ) : isError ? (
            <ErrorState
              text="Detail pesanan belum dapat dimuat."
              onRetry={() => void refetch()}
            />
          ) : !order ? (
            <ErrorState text="Detail pesanan belum tersedia." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
              <Card className="p-4 shadow-none sm:p-5">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">Nomor Pesanan</div>
                    <div className="break-all text-lg font-black sm:text-xl">
                      {order.nomorPesanan}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={order.status} />
                    <StatusBadge value={order.statusPembayaran} />
                  </div>
                </div>

                <div className="mb-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] text-slate-400">Pelanggan</div>
                    <b className="text-sm">{order.pelanggan.nama}</b>
                    <div className="break-all text-xs text-slate-500">
                      {order.pelanggan.nomorTelepon}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400">Barber</div>
                    <b className="text-sm">
                      {order.barber?.nama ?? "Belum ditentukan"}
                    </b>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400">Check-in</div>
                    <b className="text-sm">{waktu(order.checkInTime)}</b>
                    <div className="text-xs text-slate-500">
                      {tanggal(order.checkInTime)}
                    </div>
                  </div>
                </div>

                <div className="scrollbar-thin overflow-x-auto rounded-lg border border-slate-100 sm:border-0">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-2 py-2 text-left">Layanan</th>
                        <th>Durasi</th>
                        <th>Harga</th>
                        <th>Jumlah</th>
                        <th className="px-2 text-right">Subtotal</th>
                      </tr>
                    </thead>

                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-2 py-3 font-semibold">
                            {item.namaLayanan}
                          </td>
                          <td className="text-center">
                            {item.durasiMenit} menit
                          </td>
                          <td className="text-center">{rupiah(item.harga)}</td>
                          <td className="text-center">{item.qty}</td>
                          <td className="px-2 text-right">
                            {rupiah(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto mt-4 max-w-xs space-y-1 text-right text-xs">
                  <div>
                    Subtotal <b>{rupiah(order.subtotal)}</b>
                  </div>

                  {order.diskon > 0 && (
                    <div className="text-emerald-600">
                      Diskon {order.discountPercent}%{" "}
                      <b>-{rupiah(order.diskon)}</b>
                    </div>
                  )}

                  <div className="text-base font-black text-indigo-700">
                    Total {rupiah(order.total)}
                  </div>
                </div>

                {order.catatan && (
                  <div className="mt-5 rounded-lg border border-slate-200 p-3 text-xs">
                    <b>Catatan</b>
                    <div className="mt-1 whitespace-pre-wrap text-slate-500">
                      {order.catatan}
                    </div>
                  </div>
                )}
              </Card>

              <div className="space-y-4">
                <Card className="p-4 shadow-none sm:p-5">
                  <div className="mb-4 text-sm font-bold">Status Layanan</div>

                  <div className="mb-4 flex items-center justify-between gap-2 text-[10px]">
                    <span
                      className={
                        order.status === "WAITING"
                          ? "font-bold text-indigo-600"
                          : "text-slate-400"
                      }
                    >
                      Menunggu
                    </span>
                    <span>→</span>
                    <span
                      className={
                        order.status === "IN_SERVICE"
                          ? "font-bold text-amber-600"
                          : "text-slate-400"
                      }
                    >
                      Sedang Dilayani
                    </span>
                    <span>→</span>
                    <span
                      className={
                        order.status === "COMPLETED"
                          ? "font-bold text-emerald-600"
                          : "text-slate-400"
                      }
                    >
                      Layanan Selesai
                    </span>
                  </div>

                  {order.booking && <Link className="block rounded-lg bg-indigo-50 p-3 text-sm font-bold text-indigo-700" onClick={onClose} to={`/bookings/${order.booking.id}`}>Kelola booking, layanan dan pelunasan {order.booking.nomorBooking}</Link>}
                  {!order.booking && order.status === "WAITING" && (
                    <Button
                      className="w-full"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate("IN_SERVICE")}
                    >
                      Mulai Layanan
                    </Button>
                  )}

                  {!order.booking && order.status === "IN_SERVICE" && (
                    <Button
                      variant="success"
                      className="w-full"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate("COMPLETED")}
                    >
                      Selesaikan Layanan
                    </Button>
                  )}

                  {!order.booking && order.status === "COMPLETED" &&
                    order.statusPembayaran === "UNPAID" && (
                      <Button
                        className="w-full"
                        onClick={() => setPaymentOpen(true)}
                      >
                        Buka Pembayaran
                      </Button>
                    )}

                  {order.statusPembayaran === "PAID" && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-600">
                      Pembayaran Berhasil
                    </div>
                  )}

                  <div className="mt-2 grid gap-2">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => printDocument("ticket")}
                    >
                      <Printer size={15} />
                      Cetak Tiket Layanan
                    </Button>

                    {order.statusPembayaran === "PAID" && order.pembayaran && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => printDocument("invoice")}
                      >
                        <FileText size={15} />
                        Cetak Invoice
                      </Button>
                    )}
                  </div>
                </Card>

                <Card className="p-4 shadow-none sm:p-5">
                  <div className="mb-3 text-sm font-bold">Ringkasan Pesanan</div>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex justify-between gap-4">
                      <span>Jumlah layanan</span>
                      <b className="text-slate-800">
                        {order.items.reduce(
                          (total, item) => total + item.qty,
                          0,
                        )}
                      </b>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span>Total durasi</span>
                      <b className="text-slate-800">{duration} menit</b>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span>Pembayaran</span>
                      <StatusBadge value={order.statusPembayaran} />
                    </div>

                    {order.pembayaran && (
                      <>
                        <div className="flex justify-between gap-4">
                          <span>Metode</span>
                          <b className="text-slate-800">
                            {statusRamah(order.pembayaran.metode)}
                          </b>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Invoice</span>
                          <b className="break-all text-right text-slate-800">
                            {order.pembayaran.nomorInvoice}
                          </b>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Card>

      <PaymentModal
        order={order ?? null}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
      />

      {order && printMode === "ticket" && (
        <div className="print-only print-document service-ticket-print">
          <div className="print-brand">
            <img src="/barber-barbar-icon.png" alt="Barber Barbar" />
            <div>
              <div className="print-brand-name">BARBER BARBAR</div>
              <div className="print-tagline">Not Cutting Heads, Just Hair</div>
            </div>
          </div>

          <div className="print-document-title">TIKET LAYANAN</div>
          <div className="print-divider" />

          <div className="print-info-grid">
            <div>
              <span>Pesanan</span>
              <b>{order.nomorPesanan}</b>
            </div>
            <div>
              <span>Pelanggan</span>
              <b>{order.pelanggan.nama}</b>
            </div>
            <div>
              <span>Telepon</span>
              <b>{order.pelanggan.nomorTelepon}</b>
            </div>
            <div>
              <span>Barber</span>
              <b>{order.barber?.nama ?? "Belum ditentukan"}</b>
            </div>
            <div>
              <span>Check-in</span>
              <b>
                {tanggal(order.checkInTime)} {waktu(order.checkInTime)}
              </b>
            </div>
            <div>
              <span>Status</span>
              <b>{order.status.replace("_", " ")}</b>
            </div>
          </div>

          <div className="print-divider" />
          <table className="print-table">
            <thead>
              <tr>
                <th>Layanan</th>
                <th>Jumlah</th>
                <th>Durasi</th>
                <th className="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.namaLayanan}</td>
                  <td>{item.qty}</td>
                  <td>{item.durasiMenit * item.qty} menit</td>
                  <td className="text-right">{rupiah(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-divider" />
          <div className="print-total-row">
            <span>Total Durasi</span>
            <b>{duration} menit</b>
          </div>
          <div className="print-total-row">
            <span>Subtotal</span>
            <b>{rupiah(order.subtotal)}</b>
          </div>
          {order.diskon > 0 && (
            <div className="print-total-row">
              <span>Diskon Member ({order.discountPercent}%)</span>
              <b>-{rupiah(order.diskon)}</b>
            </div>
          )}
          <div className="print-grand-total">
            <span>Total</span>
            <b>{rupiah(order.total)}</b>
          </div>

          {order.catatan && (
            <div className="print-note">
              <b>Catatan:</b> {order.catatan}
            </div>
          )}

          <div className="print-footer">
            Terima kasih telah berkunjung ke BARBER BARBAR.
            <br />
            Not Cutting Heads, Just Hair
          </div>
        </div>
      )}

      {order && order.pembayaran && printMode === "invoice" && (
        <div className="print-only print-document invoice-print">
          <div className="invoice-header">
            <div className="print-brand">
              <img src="/barber-barbar-icon.png" alt="Barber Barbar" />
              <div>
                <div className="print-brand-name">BARBER BARBAR</div>
                <div className="print-tagline">
                  Not Cutting Heads, Just Hair
                </div>
              </div>
            </div>
            <div className="invoice-heading">
              <div>INVOICE</div>
              <b>{order.pembayaran.nomorInvoice}</b>
            </div>
          </div>

          <div className="print-divider" />
          <div className="invoice-meta">
            <div>
              <span>Ditagihkan Kepada</span>
              <b>{order.pelanggan.nama}</b>
              <small>{order.pelanggan.nomorTelepon}</small>
            </div>
            <div>
              <span>Detail Pembayaran</span>
              <b>
                {tanggal(order.pembayaran.dibayarPada)}{" "}
                {waktu(order.pembayaran.dibayarPada)}
              </b>
              <small>
                {statusRamah(order.pembayaran.metode)} · Pesanan {order.nomorPesanan}
              </small>
            </div>
            <div>
              <span>Barber</span>
              <b>{order.barber?.nama ?? "Belum ditentukan"}</b>
              <small>Layanan selesai</small>
            </div>
          </div>

          <table className="print-table invoice-table">
            <thead>
              <tr>
                <th>Layanan</th>
                <th>Jumlah</th>
                <th>Harga Satuan</th>
                <th className="text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.namaLayanan}</td>
                  <td>{item.qty}</td>
                  <td>{rupiah(item.harga)}</td>
                  <td className="text-right">{rupiah(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-totals">
            <div>
              <span>Subtotal</span>
              <b>{rupiah(order.subtotal)}</b>
            </div>
            {order.diskon > 0 && (
              <div>
                <span>Diskon Member ({order.discountPercent}%)</span>
                <b>-{rupiah(order.diskon)}</b>
              </div>
            )}
            <div className="invoice-total-final">
              <span>Total</span>
              <b>{rupiah(order.total)}</b>
            </div>
            <div>
              <span>Jumlah Diterima</span>
              <b>{rupiah(order.pembayaran.jumlahDiterima)}</b>
            </div>
            <div>
              <span>Kembalian</span>
              <b>{rupiah(order.pembayaran.kembalian)}</b>
            </div>
          </div>

          {order.pembayaran.catatan && (
            <div className="print-note">
              <b>Catatan Pembayaran:</b> {order.pembayaran.catatan}
            </div>
          )}

          <div className="invoice-paid-stamp">LUNAS</div>
          <div className="print-footer">
            Terima kasih telah mempercayai BARBER BARBAR.
            <br />
            Not Cutting Heads, Just Hair
          </div>
        </div>
      )}
    </div>
  );
}
