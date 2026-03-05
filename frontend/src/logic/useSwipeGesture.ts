import { useEffect, useRef, useLayoutEffect } from 'react';

interface SwipeOptions {
  target: string | 'document' | null;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minDistance?: number;
  minVelocity?: number;
  edgeGuard?: number;
  directionLockThreshold?: number;
  enabled?: boolean;
}

type Direction = 'horizontal' | 'vertical' | null;

export function useSwipeGesture({
  target,
  onSwipeLeft,
  onSwipeRight,
  minDistance = 45,
  minVelocity = 0.25,
  edgeGuard = 90,
  directionLockThreshold = 12,
  enabled = true,
}: SwipeOptions) {
  // useLayoutEffect runs synchronously after DOM mutations but before paint —
  // safe place to update refs without triggering React's "ref during render" warning
  const cbLeft = useRef(onSwipeLeft);
  const cbRight = useRef(onSwipeRight);
  useLayoutEffect(() => {
    cbLeft.current = onSwipeLeft;
  });
  useLayoutEffect(() => {
    cbRight.current = onSwipeRight;
  });

  const state = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    direction: null as Direction,
  });

  const cfg = useRef({ minDistance, minVelocity, edgeGuard, directionLockThreshold });
  useLayoutEffect(() => {
    cfg.current = { minDistance, minVelocity, edgeGuard, directionLockThreshold };
  });

  useEffect(() => {
    if (!enabled || !target) return;

    const node: EventTarget =
      target === 'document' ? document : (document.querySelector(target) ?? document);

    const s = state.current;

    function reset() {
      s.active = false;
      s.direction = null;
    }

    function onTouchStart(e: Event) {
      const te = e as TouchEvent;
      const touch = te.changedTouches[0];
      if (!touch) return;

      const { edgeGuard } = cfg.current;
      if (touch.clientY < edgeGuard || touch.clientY > window.innerHeight - edgeGuard) return;

      s.active = true;
      s.startX = touch.clientX;
      s.startY = touch.clientY;
      s.startTime = performance.now();
      s.direction = null;
    }

    function onTouchMove(e: Event) {
      const te = e as TouchEvent;
      if (!s.active) return;
      const touch = te.changedTouches[0];
      if (!touch) return;

      const { directionLockThreshold } = cfg.current;
      const dx = touch.clientX - s.startX;
      const dy = touch.clientY - s.startY;

      if (s.direction === null) {
        const totalMoved = Math.max(Math.abs(dx), Math.abs(dy));
        if (totalMoved < directionLockThreshold) return;
        s.direction = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (s.direction === 'vertical') {
        reset();
        return;
      }

      if (te.cancelable) te.preventDefault();
    }

    function onTouchEnd(e: Event) {
      const te = e as TouchEvent;
      if (!s.active || s.direction !== 'horizontal') {
        reset();
        return;
      }

      const touch = te.changedTouches[0];
      if (!touch) {
        reset();
        return;
      }

      const { minDistance, minVelocity } = cfg.current;
      const dx = touch.clientX - s.startX;
      const dt = performance.now() - s.startTime;
      const velocity = Math.abs(dx) / dt;

      const valid = Math.abs(dx) >= minDistance || velocity >= minVelocity;
      if (valid) {
        if (dx < 0) cbLeft.current?.();
        else cbRight.current?.();
      }

      reset();
    }

    function onTouchCancel() {
      reset();
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    node.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
      reset();
    };
  }, [enabled, target]);
}
