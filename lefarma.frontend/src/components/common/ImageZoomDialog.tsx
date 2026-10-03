import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ZoomImage {
  src: string;
  alt?: string;
  title?: string;
}

interface ImageZoomDialogProps {
  image: ZoomImage | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;
const DBL_CLICK_SCALE = 2.5;

export function ImageZoomDialog({ image, onClose }: ImageZoomDialogProps) {
  return (
    <Dialog open={!!image} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="h-[90vh] w-[95vw] max-w-none gap-0 overflow-hidden border-0 bg-neutral-950/95 p-0"
      >
        <DialogTitle className="sr-only">{image?.title ?? 'Vista ampliada'}</DialogTitle>
        {image && <ZoomViewport key={image.src} image={image} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ZoomViewport({ image, onClose }: { image: ZoomImage; onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const clampOffset = useCallback(
    (next: { x: number; y: number }, nextScale: number) => {
      const viewport = viewportRef.current;
      const img = imgRef.current;
      if (!viewport || !img) return next;
      const maxX = Math.max(0, (img.offsetWidth * nextScale - viewport.clientWidth) / 2);
      const maxY = Math.max(0, (img.offsetHeight * nextScale - viewport.clientHeight) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [],
  );

  const applyScale = useCallback(
    (nextScale: number, anchorX = 0, anchorY = 0) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      if (clamped === MIN_SCALE) {
        setScale(MIN_SCALE);
        setOffset({ x: 0, y: 0 });
        return;
      }
      setScale((prevScale) => {
        setOffset((prevOffset) =>
          clampOffset(
            {
              x: prevOffset.x - anchorX * (clamped / prevScale - 1),
              y: prevOffset.y - anchorY * (clamped / prevScale - 1),
            },
            clamped,
          ),
        );
        return clamped;
      });
    },
    [clampOffset],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const anchorX = e.clientX - rect.left - rect.width / 2;
      const anchorY = e.clientY - rect.top - rect.height / 2;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        if (next === MIN_SCALE) {
          setOffset({ x: 0, y: 0 });
          return next;
        }
        setOffset((prevOffset) =>
          clampOffset(
            {
              x: prevOffset.x - anchorX * (next / prev - 1),
              y: prevOffset.y - anchorY * (next / prev - 1),
            },
            next,
          ),
        );
        return next;
      });
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [clampOffset]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setOffset(
      clampOffset(
        { x: drag.baseX + e.clientX - drag.startX, y: drag.baseY + e.clientY - drag.startY },
        scale,
      ),
    );
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const anchorX = e.clientX - rect.left - rect.width / 2;
    const anchorY = e.clientY - rect.top - rect.height / 2;
    if (scale === MIN_SCALE) {
      applyScale(DBL_CLICK_SCALE, anchorX, anchorY);
    } else {
      applyScale(MIN_SCALE);
    }
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={viewportRef}
        className={`flex h-full w-full select-none items-center justify-center overflow-hidden ${
          scale > MIN_SCALE ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
        }`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
      >
        <img
          ref={imgRef}
          src={image.src}
          alt={image.alt ?? image.title ?? 'Imagen'}
          draggable={false}
          className="pointer-events-none max-h-full max-w-full object-contain"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
      {image.title && (
        <div className="pointer-events-none absolute left-4 top-4 rounded bg-black/60 px-3 py-1.5 text-sm font-medium text-white">
          {image.title}
        </div>
      )}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-black/60 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
          onClick={() => applyScale(scale / ZOOM_STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label="Reducir"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs font-medium tabular-nums text-white">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
          onClick={() => applyScale(scale * ZOOM_STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label="Ampliar"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
          onClick={() => applyScale(MIN_SCALE)}
          disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}
          aria-label="Restablecer zoom"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
