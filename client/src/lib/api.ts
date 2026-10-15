import axios from "axios";
import { pesanAman } from './teks';
export const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("barber_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login")
    ) {
      localStorage.removeItem("barber_token");
      localStorage.removeItem("barber_user");
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  },
);
const memilikiPesan = (data: unknown): data is { pesan: string } =>
  typeof data === "object" &&
  data !== null &&
  "pesan" in data &&
  typeof data.pesan === "string";
export const pesanError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Koneksi terputus. Periksa jaringan dan coba lagi.";
    if (error.response.status === 401) return error.config?.url?.includes("/auth/login") ? "Email atau kata sandi tidak sesuai." : "Sesi Anda telah berakhir. Silakan masuk kembali.";
    if (error.response.status === 429) return "Terlalu banyak percobaan. Tunggu beberapa saat, lalu coba lagi.";
    if (error.response.status >= 500) return 'Terjadi kendala. Periksa status terbaru sebelum mencoba kembali.';
    if (memilikiPesan(error.response.data)) return pesanAman(error.response.data.pesan);
    const status = error.response.status;
    return status === 400
      ? "Periksa kembali data yang dimasukkan."
      : status === 401
        ? "Sesi Anda telah berakhir. Silakan masuk kembali."
        : status === 403
          ? "Akun Anda tidak memiliki akses untuk tindakan ini."
          : status === 404
            ? "Data yang diminta tidak ditemukan."
            : status === 409
              ? "Tindakan belum dapat dilakukan. Perbarui data dan coba lagi."
              : "Terjadi kendala. Silakan coba beberapa saat lagi.";
  }
  return "Terjadi kendala. Silakan coba beberapa saat lagi.";
};
