import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
    id: string;
    open: boolean;
    setOpen: (open: boolean) => void;
    title?: React.ReactNode | string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: ModalSize;
    canClose?: boolean;
    closeOnOutsideClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    id,
    open,
    setOpen,
    title = 'Modal',
    children,
    footer,
    size = 'md',
    canClose = true,
    closeOnOutsideClick = false,
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
            default:
                return 'max-w-md';
        }
    };

    const sizeStyles = getSizeStyles();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent showCloseButton={canClose}
                className={`bg-card text-card-foreground border border-border shadow-lg rounded-lg ${sizeStyles}`}
                onInteractOutside={(e) => { if (!closeOnOutsideClick) e.preventDefault(); }}
            >
                <DialogHeader>
                    {title && (
                        <DialogTitle className="text-lg font-bold">
                            {title}
                        </DialogTitle>
                    )}
                    <DialogDescription className="sr-only">
                        {typeof title === 'string' ? title : 'Modal'}
                    </DialogDescription>
                </DialogHeader>
                <hr className="border-border" />
                <div className="min-h-0 flex-1 overflow-y-auto -mx-6 px-6 py-4">{children}</div>
                <hr className="border-border" />
                <DialogFooter>
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