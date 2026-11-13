import { randomUUID } from "node:crypto";

/**
 * Minimal socket-like connection consumed by GameEngine.
 *
 * Transport is SSE for server -> client and POST for client -> server. The
 * engine only needs event subscription, emit, identity, and close semantics.
 */
export class SseConnection {
  constructor({ identity, send, close }) {
    this.id = randomUUID();
    this.connected = true;
    this.data = { identity };
    this.handlers = new Map();
    this.sendFrame = send;
    this.closeTransport = close;
  }

  on(event, handler) {
    this.handlers.set(event, handler);
  }

  off(event) {
    this.handlers.delete(event);
  }

  emit(event, payload) {
    if (!this.connected) return;
    this.sendFrame(event, payload);
  }

  receive(event, payload) {
    if (!this.connected) return;
    const handler = this.handlers.get(event);
    if (!handler) {
      this.emit("room:error", {
        code: "unknown_event",
        message: "Unknown realtime event",
      });
      return;
    }
    handler(payload);
  }

  close() {
    if (!this.connected) return;
    this.connected = false;
    this.closeTransport?.();
  }
}
