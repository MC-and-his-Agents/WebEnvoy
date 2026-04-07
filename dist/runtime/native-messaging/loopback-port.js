export class InMemoryPort {
    #listeners = new Set();
    #peer = null;
    connect(peer) {
        this.#peer = peer;
    }
    onMessage(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    postMessage(message) {
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
export const createPortPair = () => {
    const left = new InMemoryPort();
    const right = new InMemoryPort();
    left.connect(right);
    right.connect(left);
    return [left, right];
};
