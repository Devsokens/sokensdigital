"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  /** null if the pad is still blank — nothing was ever drawn. */
  toDataURL: () => string | null;
  clear: () => void;
}

/** Draw-to-sign pad — mouse, touch and pen all go through the unified
 * Pointer Events API, so a stylus on a tablet/mobile screen works exactly
 * like a mouse drag. Backing canvas is rendered at devicePixelRatio for a
 * crisp line, while its CSS size stays the layout size. */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  { className?: string; onChange?: (isEmpty: boolean) => void }
>(function SignaturePad({ className, onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#171717";
  }, []);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pointerPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pointerPos(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setIsEmpty(false);
      onChange?.(false);
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setIsEmpty(true);
    onChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    clear,
    toDataURL: () => (hasDrawnRef.current ? canvasRef.current?.toDataURL("image/png") ?? null : null),
  }));

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="h-40 w-full touch-none"
        />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
            Signez ici avec la souris, le doigt ou un stylet
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={isEmpty}
        className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-40"
      >
        <Eraser className="size-3.5" /> Effacer la signature
      </button>
    </div>
  );
});
