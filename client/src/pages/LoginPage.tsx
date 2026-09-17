import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";
import { Button, Card, Input, Label } from "../components/ui";
import { pesanError } from "../lib/api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function LoginPage() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        loginSchema.parse({ email, password });
        await login(email, password);
      } else {
        if (password !== confirm) {
          throw new Error("Password confirmation does not match");
        }
        await register(name, email, password, confirm);
      }
      nav("/");
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? "Email or password format is invalid"
          : e instanceof Error && e.message.includes("confirmation")
            ? e.message
            : pesanError(e),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[#f4f6fb] lg:grid-cols-2">
      <div className="hidden bg-gradient-to-br from-[#0b1530] via-[#101d46] to-indigo-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <img
            src="/barber-barbar-logo.png"
            alt="Barber Barbar — Not Cutting Heads, Just Hair"
            className="w-full max-w-[390px] object-contain object-left"
          />
        </div>

        <div>
          <h1 className="mt-5 max-w-lg text-4xl font-black leading-tight">
            Manage orders, customers, barbers and payments in one place.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
            A clean workflow from check-in to service completion, payment and
            history.
          </p>
        </div>

        <div className="text-xs text-slate-400">
          Barber Barbar • Not Cutting Heads, Just Hair
        </div>
      </div>

      <div className="grid place-items-center p-5">
        <Card className="w-full max-w-md p-7">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img
              src="/barber-barbar-icon.png"
              alt="Barber Barbar"
              className="size-14 object-contain"
            />
            <div>
              <div className="text-xl font-black text-slate-900">
                Barber Barbar
              </div>
              <div className="text-[10px] font-semibold text-slate-500">
                Not Cutting Heads, Just Hair
              </div>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-black text-slate-900">
              {mode === "login" ? "Welcome back" : "Create staff account"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login"
                ? "Sign in to continue to Barber Barbar"
                : "New registrations receive STAFF access"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {mode === "register" && (
              <div>
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600">
                {error}
              </div>
            )}

            <Button className="w-full" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Register"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="mt-5 w-full text-center text-xs font-semibold text-indigo-600"
          >
            {mode === "login" ? "Create a STAFF account" : "Back to sign in"}
          </button>
        </Card>
      </div>
    </div>
  );
}
