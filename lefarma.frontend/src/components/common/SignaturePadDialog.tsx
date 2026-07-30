import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Eraser, Loader2, PenLine, Smartphone, Undo2 } from 'lucide-react';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

// Pen tuning: slow strokes draw thick, fast strokes draw thin (ballpoint feel)
const MAX_W = 5.5;
const MIN_W = 1.2;
const K = 1.5;
const WIDTH_SMOOTHING = 0.35;
const MIN_POINT_DIST = 1.5;
const TAPER_MIN_WIDTH = 0.25;

interface SignaturePadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File) => void;
  isSaving?: boolean;
}

type Point = { x: number; y: number; w: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const taperCount = (n: number) => Math.max(4, Math.floor(n * 0.1));

const startTaper = (i: number, t: number) =>
  i >= t ? 1 : TAPER_MIN_WIDTH + (1 - TAPER_MIN_WIDTH) * (i / t);

const endTaper = (i: number, n: number, t: number) => {
  const fromEnd = n - 1 - i;
  return fromEnd >= t ? 1 : TAPER_MIN_WIDTH + (1 - TAPER_MIN_WIDTH) * (fromEnd / t);
};

const taperFactor = (i: number, n: number) => {
  const t = taperCount(n);
  return Math.min(startTaper(i, t), endTaper(i, n, t));
};

function drawSegment(ctx: CanvasRenderingContext2D, p0: Point, p1: Point, f0: number, f1: number) {
  ctx.strokeStyle = 'black';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = (p0.w * f0 + p1.w * f1) / 2;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Point[]) {
  const n = stroke.length;
  if (n === 0) return;
  if (n === 1) {
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(stroke[0].x, stroke[0].y, (stroke[0].w * taperFactor(0, 1)) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < n; i++) {
    drawSegment(ctx, stroke[i - 1], stroke[i], taperFactor(i - 1, n), taperFactor(i, n));
  }
}

export function SignaturePadDialog({ open, onOpenChange, onSave, isSaving = false }: SignaturePadDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Point[][]>([]);
  const drawingRef = useRef(false);
  const lastRawRef = useRef<{ x: number; y: number; t: number; w: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isCoarsePortrait, setIsCoarsePortrait] = useState(false);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokesRef.current) renderStroke(ctx, stroke);
  }, []);

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setIsCoarsePortrait(coarse && window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  useEffect(() => {
    if (open) {
      strokesRef.current = [];
      setIsEmpty(true);
      redrawAll();
    }
  }, [open, redrawAll]);

  const toCanvasPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = toCanvasPoint(e.clientX, e.clientY);
    lastRawRef.current = { x, y, t: e.timeStamp, w: MAX_W };
    strokesRef.current.push([{ x, y, w: MAX_W }]);
    setIsEmpty(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) renderStroke(ctx, strokesRef.current[strokesRef.current.length - 1]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastRawRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];

    for (const ev of events) {
      const last: { x: number; y: number; t: number; w: number } = lastRawRef.current!;
      const { x, y } = toCanvasPoint(ev.clientX, ev.clientY);
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < MIN_POINT_DIST) continue;

      const dt = Math.max(ev.timeStamp - last.t, 1);
      const speed = dist / dt;
      const target = clamp(MAX_W - speed * K, MIN_W, MAX_W);
      const w: number = last.w + (target - last.w) * WIDTH_SMOOTHING;

      const point = { x, y, w };
      stroke.push(point);
      // Live draw with start taper only; pointerup redraw applies the end taper
      drawSegment(ctx, stroke[stroke.length - 2], point, startTaper(stroke.length - 2, 4), 1);
      lastRawRef.current = { x, y, t: ev.timeStamp, w };
    }
  };

  const handlePointerEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRawRef.current = null;
    // Normalize the finished stroke so live drawing and redrawAll match exactly
    redrawAll();
  };

  const handleUndo = () => {
    strokesRef.current.pop();
    setIsEmpty(strokesRef.current.length === 0);
    redrawAll();
  };

  const handleClear = () => {
    strokesRef.current = [];
    setIsEmpty(true);
    redrawAll();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokesRef.current.length === 0) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], 'firma.png', { type: 'image/png' }));
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Dibuja tu firma
          </DialogTitle>
          <DialogDescription>
            Firma dentro del recuadro usando el mouse, el dedo o un lápiz digital.
          </DialogDescription>
        </DialogHeader>
        {isCoarsePortrait ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 py-16">
            <Smartphone className="h-10 w-10 rotate-90 text-muted-foreground" />
            <p className="text-center text-sm font-medium text-muted-foreground">
              Gira tu celular a horizontal para firmar con el dedo
            </p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="aspect-video w-full h-auto touch-none select-none rounded-lg border bg-white"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          />
        )}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={isEmpty || isCoarsePortrait}>
            <Undo2 className="mr-2 h-4 w-4" />
            Deshacer
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={isEmpty || isCoarsePortrait}>
            <Eraser className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={isEmpty || isSaving || isCoarsePortrait}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Guardar firma
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
