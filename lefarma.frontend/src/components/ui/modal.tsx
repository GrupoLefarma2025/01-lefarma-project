import React from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'w75' | 'full';

interface ModalProps {
    id: string;
    open: boolean;
    setOpen: (open: boolean) => void;
    title?: React.ReactNode | string;
    subtitle?: React.ReactNode | string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: ModalSize;
    canClose?: boolean;
    closeOnOutsideClick?: boolean;
    /** Si retorna false, el cierre (X, Esc, clic fuera) se cancela. */
    beforeClose?: () => boolean;
    /** Reduce el espacio vertical del marco (encabezado, separadores y relleno). Útil con zoom alto o pantallas bajas. */
    compact?: boolean;
    /** Mientras es true, cubre el modal con un indicador de progreso y bloquea su cierre e interacción. */
    busy?: boolean;
    /** Texto del indicador de progreso cuando `busy` está activo. */
    busyLabel?: string;
}

export const Modal: React.FC<ModalProps> = ({
    open,
    setOpen,
    title = 'Modal',
    subtitle,
    children,
    footer,
    size = 'md',
    canClose = true,
    closeOnOutsideClick = false,
    beforeClose,
    compact = false,
    busy = false,
    busyLabel,
}) => {
    // Estilos basados en el tamaño estándar
    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return 'max-w-sm';
            case 'md':
                return 'max-w-md';
            case 'lg':
                return 'max-w-lg';
            case 'xl':
                return 'max-w-xl';
            case 'wide':
                return 'max-w-[90vw] max-h-[calc(100dvh-2rem)]';
            case 'w75':
                return 'w-[75vw] max-w-[75vw] max-h-[calc(100dvh-2rem)]';
            case 'full':
                return 'max-w-[80vw] max-h-[calc(100dvh-2rem)]';
            default:
                return 'max-w-md';
        }
    };

    const sizeStyles = getSizeStyles();

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) {
                    if (busy) return;
                    if (beforeClose && !beforeClose()) return;
                }
                setOpen(o);
            }}
        >
            <DialogContent showCloseButton={canClose && !busy}
                aria-busy={busy || undefined}
                className={cn(
                    'bg-card text-card-foreground border border-border shadow-lg rounded-lg',
                    sizeStyles,
                    compact && 'gap-2 p-4'
                )}
                onInteractOutside={(e) => { if (!closeOnOutsideClick) e.preventDefault(); }}
            >
                {busy && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/90 p-6 text-center backdrop-blur-sm"
                    >
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-semibold">{busyLabel ?? 'Procesando…'}</p>
                        <p className="text-xs text-muted-foreground">No cierres esta ventana.</p>
                    </div>
                )}
                <DialogHeader className="shrink-0">
                    {title && (
                        <DialogTitle className={cn('font-bold', compact ? 'text-base' : 'text-lg')}>
                            {title}
                        </DialogTitle>
                    )}
                    <DialogDescription className={subtitle ? 'text-sm text-muted-foreground' : 'sr-only'}>
                        {subtitle || (typeof title === 'string' ? title : 'Modal')}
                    </DialogDescription>
                </DialogHeader>
                <hr className="border-border shrink-0" />
                <div className={cn('min-h-0 flex-1 overflow-y-auto', compact ? '-mx-4 px-4 py-2' : '-mx-6 px-6 py-4')}>{children}</div>
                <hr className="border-border shrink-0" />
                <DialogFooter className="shrink-0">
                    {footer ? (
                        footer
                    ) : (
                        canClose && (
                            <button
                                className="btn"
                                onClick={() => setOpen(false)}
                            >
                                Cerrar
                            </button>
                        )
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};