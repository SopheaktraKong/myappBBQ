import { useEffect, useRef } from "react";
import { wsUrl } from "@/lib/api";

/**
 * StrictMode-safe WebSocket hook.
 * - Handles the "WebSocket is closed before the connection is established" warning
 *   by waiting for OPEN before closing, and silences the connect-time error event.
 */
export function useAppSocket(onMessage) {
  const cbRef = useRef(onMessage);
  useEffect(() => { cbRef.current = onMessage; }, [onMessage]);

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      return;
    }
    ws.onerror = (ev) => { if (process.env.NODE_ENV !== "production") console.debug("[ws] connect error (ignored)", ev); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (cbRef.current) cbRef.current(msg);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.debug("[ws] bad payload", err);
      }
    };
    return () => {
      if (!ws) return;
      const swallow = (err) => { if (process.env.NODE_ENV !== "production") console.debug("[ws] close error", err); };
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
        try { ws.close(); } catch (err) { swallow(err); }
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => { try { ws.close(); } catch (err) { swallow(err); } };
      }
    };
  }, []);
}
