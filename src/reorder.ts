import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const SCROLL_EDGE = 90;
const SCROLL_MAX = 22;
const DRAG_THRESHOLD = 4;

// Native drag and drop does not scroll the page, so the drag is driven by pointer events and the
// scrolling is done here: without it the list below the fold is unreachable.
const autoScrollStep = (clientY: number): number => {
  const above = SCROLL_EDGE - clientY;
  const below = SCROLL_EDGE - (window.innerHeight - clientY);
  if (above > 0) return -Math.ceil((above / SCROLL_EDGE) * SCROLL_MAX);
  if (below > 0) return Math.ceil((below / SCROLL_EDGE) * SCROLL_MAX);
  return 0;
};

export interface Reorder {
  draggingId: string | null;
  /** Where the dragged item would land, as an index between items; null when it would not move. */
  dropIndex: number | null;
  register: (id: string) => (element: HTMLElement | null) => void;
  onPointerDown: (id: string) => (event: ReactPointerEvent) => void;
}

export const useReorder = (ids: string[], onMove: (from: number, to: number) => void): Reorder => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);

  const elements = useRef(new Map<string, HTMLElement>());
  const setters = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const cancelDrag = useRef<(() => void) | null>(null);
  const idsRef = useRef(ids);
  const onMoveRef = useRef(onMove);

  idsRef.current = ids;
  onMoveRef.current = onMove;

  useEffect(() => () => cancelDrag.current?.(), []);

  const register = useCallback((id: string) => {
    const existing = setters.current.get(id);
    if (existing) return existing;

    const setter = (element: HTMLElement | null) => {
      if (element) elements.current.set(id, element);
      else elements.current.delete(id);
    };
    setters.current.set(id, setter);
    return setter;
  }, []);

  // The whole item is a drop zone, not just its heading, so a drag that ends over a card still
  // lands where it looks like it will.
  const insertionIndexFor = useCallback((clientY: number): number => {
    const order = idsRef.current;
    for (let index = 0; index < order.length; index += 1) {
      const element = elements.current.get(order[index] ?? '');
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return order.length;
  }, []);

  const onPointerDown = useCallback(
    (id: string) => (event: ReactPointerEvent) => {
      if (event.button !== 0 || cancelDrag.current) return;
      if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;

      const startY = event.clientY;
      let isDragging = false;
      let pointerY = startY;
      let frame = 0;
      let insertion = idsRef.current.indexOf(id);

      const track = (clientY: number) => {
        pointerY = clientY;
        insertion = insertionIndexFor(clientY);
        setInsertAt(insertion);
      };

      const scroll = () => {
        const step = autoScrollStep(pointerY);
        if (step !== 0) {
          window.scrollBy(0, step);
          track(pointerY);
        }
        frame = window.requestAnimationFrame(scroll);
      };

      const onMovePointer = (moveEvent: PointerEvent) => {
        if (!isDragging) {
          if (Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD) return;
          isDragging = true;
          document.body.classList.add('is-reordering');
          setDraggingId(id);
          frame = window.requestAnimationFrame(scroll);
        }
        moveEvent.preventDefault();
        track(moveEvent.clientY);
      };

      const stop = (commit: boolean) => {
        cancelDrag.current = null;
        window.cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', onMovePointer);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKeyDown);
        document.body.classList.remove('is-reordering');
        setDraggingId(null);
        setInsertAt(null);
        if (!commit || !isDragging) return;

        const from = idsRef.current.indexOf(id);
        const to = insertion > from ? insertion - 1 : insertion;
        if (from >= 0 && to !== from) onMoveRef.current(from, to);
      };

      const onUp = () => stop(true);
      const onCancel = () => stop(false);
      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === 'Escape') stop(false);
      };

      window.addEventListener('pointermove', onMovePointer, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKeyDown);
      cancelDrag.current = () => stop(false);
    },
    [insertionIndexFor],
  );

  const draggingIndex = draggingId === null ? -1 : ids.indexOf(draggingId);
  const isNoOp = insertAt === null || insertAt === draggingIndex || insertAt === draggingIndex + 1;

  return { draggingId, dropIndex: isNoOp ? null : insertAt, register, onPointerDown };
};
