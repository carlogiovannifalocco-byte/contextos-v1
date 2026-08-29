type Listener = (event: unknown) => void;

class RealtimeHub {
  private sse = new Map<string, Set<Listener>>();
  private sockets = new Map<string, Set<{ send: (payload: string) => void }>>();

  subscribeSse(projectId: string, listener: Listener): () => void {
    const set = this.sse.get(projectId) ?? new Set();
    set.add(listener);
    this.sse.set(projectId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.sse.delete(projectId);
    };
  }

  subscribeWs(projectId: string, socket: { send: (payload: string) => void }): () => void {
    const set = this.sockets.get(projectId) ?? new Set();
    set.add(socket);
    this.sockets.set(projectId, set);
    return () => {
      set.delete(socket);
      if (set.size === 0) this.sockets.delete(projectId);
    };
  }

  publish(projectId: string, event: unknown) {
    const payload = JSON.stringify(event);
    for (const listener of this.sse.get(projectId) ?? []) listener(event);
    for (const socket of this.sockets.get(projectId) ?? []) {
      try {
        socket.send(payload);
      } catch {
        /* closed */
      }
    }
  }
}

export const hub = new RealtimeHub();
