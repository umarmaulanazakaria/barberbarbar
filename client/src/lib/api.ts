import axios from "axios";
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
    if (!error.response) return "We couldn't connect. Please try again.";
    if (memilikiPesan(error.response.data)) return error.response.data.pesan;
    const status = error.response.status;
    return status === 400
      ? "Please check the information and try again."
      : status === 401
        ? "Your session has ended. Please sign in again."
        : status === 403
          ? "You don't have permission to do this."
          : status === 404
            ? "The requested information could not be found."
            : status === 409
              ? "This information is already in use."
              : "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
};
