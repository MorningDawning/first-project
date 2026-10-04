import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../api/client";
import { API_URL } from "../api/config";

export type RealtimeEvent =
  | { type: "message"; chatId: string; messageId: string; fromId: string }
  | { type: "typing"; chatId: string; userId: string; name: string }
  | { type: "read"; chatId: string; userId: string; at: string }
  | { type: "chat"; chatId: string };

type Handler = (event: RealtimeEvent) => void;

type Value = {
  connected: boolean;
  send: (data: object) => void;
  subscribe: (handler: Handler) => () => void;
};

const RealtimeContext = createContext<Value | null>(null);

/**
 * Одно живое соединение (WebSocket) на всё приложение: новые сообщения,
 * «прочитано» и «печатает…» приходят сразу, без опроса. Если связь рвётся,
 * переподключаемся сами; экраны при этом продолжают редко опрашивать сервер как запасной путь.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const handlers = useRef(new Set<Handler>());

  useEffect(() => {
    if (!isAuthenticated) return;
    let closed = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      const token = await getToken();
      if (closed || !token) return;
      const ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(String(e.data)) as RealtimeEvent;
          handlers.current.forEach((h) => h(event));
        } catch {
          // не наше сообщение
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (socket.current === ws) socket.current = null;
        setConnected(false);
        if (!closed) retry = setTimeout(connect, Math.min(15_000, 1_000 * 2 ** attempt++));
      };
    };
    connect();

    // Вернулись в приложение — не ждём очередной попытки, подключаемся сразу.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active" && !socket.current && !closed) {
        clearTimeout(retry);
        attempt = 0;
        connect();
      }
    });

    return () => {
      closed = true;
      clearTimeout(retry);
      appState.remove();
      socket.current?.close();
      socket.current = null;
      setConnected(false);
    };
  }, [isAuthenticated]);

  const send = useCallback((data: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(data));
  }, []);

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  const value = useMemo(() => ({ connected, send, subscribe }), [connected, send, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

function useRealtime(): Value {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime нужно вызывать внутри RealtimeProvider");
  return ctx;
}

/** Подписка на события; обработчик можно менять между рендерами без переподписки. */
export function useRealtimeEvents(handler: Handler) {
  const { subscribe } = useRealtime();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe]);
}

export function useRealtimeSend() {
  return useRealtime().send;
}

export function useRealtimeConnected() {
  return useRealtime().connected;
}
