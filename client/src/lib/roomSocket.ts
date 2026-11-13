"use client";

export type RoomAuth = {
  token: string | null;
  displayName?: string;
  avatarUrl?: string | null;
};

type Listener = (payload: unknown) => void;

const ACTION_EVENTS = new Set([
  "room:join",
  "room:spectate",
  "room:leave",
  "room:action",
  "game:event",
  "room:sync-request",
]);

/**
 * Small event facade over SSE (server -> client) and POST (client -> server).
 * The game engine still emits the same event names.
 */
export class RealtimeSocket {
  id: string | null = null;
  connected = false;
  auth: RoomAuth = { token: null };

  private listeners = new Map<string, Set<Listener>>();
  private abort: AbortController | null = null;
  private connectionId: string | null = null;
  private pending: Array<{ event: string; payload: unknown }> = [];
  private manualClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private opening = false;

  on<T>(event: string, listener: (payload: T) => void) {
    const set = this.listeners.get(event) || new Set<Listener>();
    set.add(listener as Listener);
    this.listeners.set(event, set);
    return this;
  }

  once<T>(event: string, listener: (payload: T) => void) {
    const wrapped = (payload: unknown) => {
      this.off(event, wrapped);
      listener(payload as T);
    };
    return this.on(event, wrapped);
  }

  off<T>(event: string, listener?: (payload: T) => void) {
    if (!listener) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(listener as Listener);
    return this;
  }

  removeAllListeners() {
    this.listeners.clear();
    return this;
  }

  private dispatch(event: string, payload?: unknown) {
    for (const listener of [...(this.listeners.get(event) || [])]) {
      listener(payload);
    }
  }

  async connect(): Promise<this> {
    this.manualClose = false;
    if (this.connected || this.opening) return this;
    this.opening = true;
    try {
      const auth = authFactory ? await refreshRoomAuth() : this.auth;
      if (!auth?.token) throw new Error("Sign in to join this room");
      this.auth = auth;
      await this.openStream(auth.token);
      return this;
    } catch (error) {
      this.opening = false;
      const data =
        error && typeof error === "object" && "data" in error
          ? (error as { data?: unknown }).data
          : undefined;
      this.dispatch("connect_error", Object.assign(error as Error, { data }));
      throw error;
    }
  }

  private async openStream(token: string) {
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;

    let response: Response;
    try {
      response = await fetch("/api/realtime/stream", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      this.opening = false;
      throw error;
    }

    if (!response.ok || !response.body) {
      this.opening = false;
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // The server may not have returned JSON.
      }
      const errorPayload = payload as
        | { error?: { code?: string; message?: string } }
        | null;
      const error = new Error(
        errorPayload?.error?.message || "Could not connect to the game server",
      ) as Error & { data?: { code?: string; message?: string } };
      error.data = errorPayload?.error;
      throw error;
    }

    void this.readStream(response.body, controller);
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    controller: AbortController,
  ) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          this.handleFrame(block);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (!this.manualClose && (error as Error)?.name !== "AbortError") {
        this.dispatch("connect_error", error);
      }
    } finally {
      if (this.abort === controller) {
        this.abort = null;
        this.connected = false;
        this.id = null;
        this.connectionId = null;
        this.opening = false;
        this.dispatch("disconnect");
        if (!this.manualClose) this.scheduleReconnect();
      }
    }
  }

  private handleFrame(block: string) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;

    let payload: unknown = null;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (event === "realtime:ready") {
      this.connectionId = String(
        (payload as { connectionId?: unknown }).connectionId,
      );
      this.id = this.connectionId;
      this.connected = true;
      this.opening = false;
      this.reconnectAttempts = 0;
      this.dispatch("connect");
      this.flushPending();
      return;
    }

    this.dispatch(event, payload);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.manualClose) return;
    const delay = Math.min(4000, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private async flushPending() {
    const pending = this.pending;
    this.pending = [];
    for (const item of pending) await this.post(item.event, item.payload);
  }

  emit(event: string, payload: unknown = {}) {
    if (!ACTION_EVENTS.has(event)) {
      this.dispatch(event, payload);
      return this;
    }
    if (!this.connectionId) {
      this.pending.push({ event, payload });
      return this;
    }
    void this.post(event, payload);
    return this;
  }

  private async post(event: string, payload: unknown) {
    const connectionId = this.connectionId;
    if (!connectionId) {
      this.pending.push({ event, payload });
      return;
    }
    const token = this.auth?.token;
    if (!token) {
      this.dispatch("room:error", {
        code: "unauthorized",
        message: "Sign in to play",
      });
      return;
    }

    const response = await fetch("/api/realtime/action", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ connectionId, event, payload }),
    }).catch(() => null);

    if (!response) {
      this.dispatch("room:error", {
        code: "network_error",
        message: "Could not reach the game server",
      });
      return;
    }

    if (response.status === 409) {
      this.abort?.abort();
      return;
    }

    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // Ignore malformed error responses.
      }
      const errorPayload = body as
        | { error?: { code?: string; message?: string } }
        | null;
      this.dispatch("room:error", {
        code: errorPayload?.error?.code || "request_failed",
        message: errorPayload?.error?.message || "Could not send that action",
      });
    }
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.abort?.abort();
    this.abort = null;
    this.connected = false;
    this.id = null;
    this.connectionId = null;
    this.opening = false;
    this.pending = [];
    this.dispatch("disconnect");
  }
}

let socket: RealtimeSocket | null = null;
let authFactory: (() => Promise<RoomAuth>) | null = null;
let authRetries = 0;

export function setRoomAuthFactory(factory: () => Promise<RoomAuth>) {
  authFactory = factory;
}

export function createRealtimeSocket() {
  return new RealtimeSocket();
}

export function getRoomSocket(): RealtimeSocket {
  if (!socket) socket = new RealtimeSocket();
  return socket;
}

export async function refreshRoomAuth(): Promise<RoomAuth | null> {
  if (!authFactory) return null;
  const auth = await authFactory();
  const current = getRoomSocket();
  current.auth = { ...auth, token: auth.token };
  return auth;
}

export async function connectRoomSocket(): Promise<RealtimeSocket> {
  const current = getRoomSocket();
  const auth = await refreshRoomAuth();
  if (!auth?.token) throw new Error("Sign in to join this room");
  if (!current.connected) await current.connect();
  return current;
}

export function disconnectRoomSocket() {
  socket?.disconnect();
  socket = null;
}

export function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function noteSocketAuthRetry(max = 3) {
  authRetries += 1;
  return authRetries <= max;
}

export function resetSocketAuthRetry() {
  authRetries = 0;
}
