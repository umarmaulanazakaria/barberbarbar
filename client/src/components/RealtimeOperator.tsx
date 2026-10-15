import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { mulaiRealtimeOperator } from "../lib/sinkronisasi-realtime";

export default function RealtimeOperator() {
  const { token, user, loading } = useAuth();
  const klien = useQueryClient();
  const role = user?.role;
  const id = user?.id;
  useEffect(() => {
    if (!token || !role || loading) return;
    return mulaiRealtimeOperator(token, role, klien, window, document);
  }, [token, role, id, loading, klien]);
  return null;
}
