BEGIN;
-- Additive: tidak mengubah row, constraint, enum atau alur keuangan existing.
-- NOTIFY PostgreSQL hanya dikirim setelah COMMIT; rollback membuang sinyal.
CREATE FUNCTION public.kirim_sinyal_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  data jsonb; lama jsonb; jenis text; aksi text; id_sumber integer;
  id_booking integer; id_pesanan integer; id_pelanggan integer;
  operator_scope text := 'ALL';
BEGIN
  IF TG_OP = 'DELETE' THEN data := to_jsonb(OLD); ELSE data := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    lama := to_jsonb(OLD);
    -- Timestamp teknis / metadata provider bukan perubahan domain baru.
    IF (data - ARRAY['diperbaruiPada','fingerprintProvider','kodeProvider','statusProvider',
       'jenisPembayaranProvider','idTransaksiProvider']) =
       (lama - ARRAY['diperbaruiPada','fingerprintProvider','kodeProvider','statusProvider',
       'jenisPembayaranProvider','idTransaksiProvider']) THEN RETURN NULL; END IF;
  END IF;
  id_sumber := (data->>'id')::integer;
  aksi := CASE WHEN TG_OP = 'DELETE' THEN 'DELETED' WHEN TG_OP = 'INSERT' THEN 'CREATED' ELSE 'UPDATED' END;
  CASE TG_TABLE_NAME
    WHEN 'Booking' THEN jenis := 'booking.changed'; id_booking := id_sumber; id_pelanggan := (data->>'pelangganId')::integer;
      aksi := coalesce(data->>'status',aksi);
    WHEN 'RiwayatBooking' THEN jenis := 'booking.changed'; id_booking := (data->>'bookingId')::integer; aksi := data->>'aksi';
    WHEN 'ItemBooking' THEN jenis := 'booking.changed'; id_booking := (data->>'bookingId')::integer; aksi := 'ITEMS_CHANGED';
    WHEN 'UsulanBarberBooking' THEN jenis := 'booking.changed'; id_booking := (data->>'bookingId')::integer; aksi := 'BARBER_' || coalesce(data->>'status',aksi);
    WHEN 'TransaksiPembayaranBooking' THEN jenis := 'payment.changed'; id_booking := (data->>'bookingId')::integer;
      aksi := coalesce(data->>'tujuan','PAYMENT') || '_' || coalesce(data->>'status',aksi);
    WHEN 'InvoiceBooking' THEN jenis := 'payment.changed'; id_booking := (data->>'bookingId')::integer; aksi := 'INVOICE_FINAL';
    WHEN 'PermohonanRefundBooking' THEN jenis := 'refund.changed'; id_booking := (data->>'bookingId')::integer;
      operator_scope := 'ADMIN'; aksi := coalesce(data->>'status',aksi);
    WHEN 'Pesanan' THEN jenis := 'order.changed'; id_pesanan := id_sumber; id_pelanggan := (data->>'pelangganId')::integer;
      aksi := coalesce(data->>'statusPembayaran',aksi) || '_' || coalesce(data->>'status','ORDER');
    WHEN 'ItemPesanan' THEN jenis := 'order.changed'; id_pesanan := (data->>'pesananId')::integer; aksi := 'ITEMS_CHANGED';
    WHEN 'Pembayaran' THEN jenis := 'order.changed'; id_pesanan := (data->>'pesananId')::integer; aksi := 'PAID';
    WHEN 'Membership' THEN jenis := 'membership.changed'; id_pelanggan := (data->>'pelangganId')::integer;
      aksi := CASE WHEN TG_OP = 'DELETE' THEN 'DELETED' WHEN (data->>'isActive')::boolean THEN 'ACTIVE' ELSE 'INACTIVE' END;
    WHEN 'PermohonanMembership' THEN jenis := 'membership.changed'; id_pelanggan := (data->>'pelangganId')::integer;
      operator_scope := 'ADMIN'; aksi := coalesce(data->>'status',aksi);
    WHEN 'Pelanggan' THEN jenis := 'customer.changed'; id_pelanggan := id_sumber;
    WHEN 'AkunPelanggan' THEN jenis := 'customer.changed'; id_pelanggan := (data->>'pelangganId')::integer; aksi := 'ACCOUNT_CHANGED';
    WHEN 'PermohonanPengaitanAkun' THEN jenis := 'account-link.changed'; operator_scope := 'ADMIN';
      aksi := coalesce(data->>'status',aksi);
    WHEN 'Barber', 'Layanan' THEN jenis := 'catalog.changed'; aksi := TG_TABLE_NAME || '_' || aksi;
    ELSE RETURN NULL;
  END CASE;
  IF id_booking IS NOT NULL THEN
    IF id_pelanggan IS NULL THEN SELECT "pelangganId" INTO id_pelanggan FROM "Booking" WHERE id = id_booking; END IF;
    IF jenis <> 'refund.changed' THEN id_sumber := id_booking; END IF;
  ELSIF id_pesanan IS NOT NULL THEN
    IF id_pelanggan IS NULL THEN SELECT "pelangganId" INTO id_pelanggan FROM "Pesanan" WHERE id = id_pesanan; END IF;
    id_sumber := id_pesanan;
  ELSIF jenis IN ('membership.changed','customer.changed') THEN id_sumber := id_pelanggan;
  END IF;
  IF TG_OP = 'DELETE' THEN aksi := 'DELETED'; END IF;
  -- Tidak menyalin OLD/NEW, nama, telepon, email, hash, token atau nominal.
  PERFORM pg_notify('barberbarbar_realtime', jsonb_build_object(
    'jenis', jenis, 'id', id_sumber, 'aksi', aksi, 'pelangganId', id_pelanggan,
    'operator', operator_scope, 'versi', txid_current()::text,
    'waktu', statement_timestamp(), 'refetch', true)::text);
  RETURN NULL;
END;
$$;
DO $$
DECLARE tabel text;
BEGIN
  FOREACH tabel IN ARRAY ARRAY['Booking','RiwayatBooking','ItemBooking','UsulanBarberBooking',
    'TransaksiPembayaranBooking','InvoiceBooking','PermohonanRefundBooking','Pesanan','ItemPesanan',
    'Pembayaran','Membership','PermohonanMembership','Pelanggan','AkunPelanggan',
    'PermohonanPengaitanAkun','Barber','Layanan'] LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.kirim_sinyal_realtime()',
      'realtime_sinyal_' || tabel, tabel);
  END LOOP;
END;
$$;
COMMIT;
