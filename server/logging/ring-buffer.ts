/* ---------------------------------------
    A fixed-size list that overwrites its oldest entry when full, so memory can never grow past `capacity` items.
    Each item carries a rising id, so a reader can ask "everything after id 120" and only get what is new.
--------------------------------------- */

export class RingBuffer<T extends { id: number }> {
  private readonly slots: Array<T | undefined>;
  private nextSlot = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.slots = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.slots[this.nextSlot] = item;
    this.nextSlot = (this.nextSlot + 1) % this.capacity;
  }

  /* -- Items with an id above `afterId`, oldest first -- */
  itemsAfter(afterId: number): T[] {
    const ordered = [...this.slots.slice(this.nextSlot), ...this.slots.slice(0, this.nextSlot)];
    return ordered.filter((item): item is T => item !== undefined && item.id > afterId);
  }
}
