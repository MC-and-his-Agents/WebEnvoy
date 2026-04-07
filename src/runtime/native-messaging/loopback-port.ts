export class InMemoryPort<TMessage> {
  #listeners = new Set<(message: TMessage) => void>();
  #peer: InMemoryPort<TMessage> | null = null;

  connect(peer: InMemoryPort<TMessage>): void {
    this.#peer = peer;
  }

  onMessage(listener: (message: TMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  postMessage(message: TMessage): void {
    const peer = this.#peer;
    if (!peer) {
      return;
    }

    queueMicrotask(() => {
      for (const listener of peer.#listeners) {
        listener(message);
      }
    });
  }
}

export const createPortPair = <TMessage>(): [InMemoryPort<TMessage>, InMemoryPort<TMessage>] => {
  const left = new InMemoryPort<TMessage>();
  const right = new InMemoryPort<TMessage>();
  left.connect(right);
  right.connect(left);
  return [left, right];
};
