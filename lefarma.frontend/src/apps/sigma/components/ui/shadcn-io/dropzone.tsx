import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";

type DropzoneProps = {
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  minSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  onDrop?: (files: File[]) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
  className?: string;
};

const isAccepted = (file: File, accept?: Record<string, string[]>) => {
  if (!accept || Object.keys(accept).length === 0) return true;
  return Object.keys(accept).some((rule) => {
    if (rule.endsWith("/*")) {
      const prefix = rule.replace("/*", "");
      return file.type.startsWith(prefix);
    }
    return file.type === rule;
  });
};

export function Dropzone({
  accept,
  maxFiles,
  maxSize,
  minSize,
  multiple = true,
  disabled = false,
  onDrop,
  onError,
  children,
  className,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = accept ? Object.keys(accept).join(",") : undefined;

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      let files = Array.from(fileList);

      if (!multiple && files.length > 1) {
        files = files.slice(0, 1);
      }
      if (maxFiles && files.length > maxFiles) {
        files = files.slice(0, maxFiles);
      }

      const filtered = files.filter((file) => {
        if (!isAccepted(file, accept)) {
          onError?.(new Error("Tipo de archivo no permitido"));
          return false;
        }
        if (maxSize && file.size > maxSize) {
          onError?.(new Error(`El archivo supera el máximo permitido (${Math.round(maxSize / (1024 * 1024))} MB)`));
          return false;
        }
        if (minSize && file.size < minSize) {
          onError?.(new Error("El archivo es demasiado pequeño"));
          return false;
        }
        return true;
      });

      if (filtered.length) {
        onDrop?.(filtered);
      }
    },
    [accept, maxFiles, maxSize, minSize, multiple, onDrop, onError]
  );

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border border-dashed border-muted-foreground/50 bg-muted/20 p-4 transition hover:border-primary/70 hover:bg-muted/40 cursor-pointer",
        isDragOver && "border-primary bg-primary/5",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
      onClick={openPicker}
      onDragOver={(e) => {
        e.preventDefault();
        if (disabled) return;
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (disabled) return;
        setIsDragOver(false);
        handleFiles(e.dataTransfer?.files || null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={acceptAttr}
        multiple={multiple}
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        }}
      />
      {children}
    </div>
  );
}

export function DropzoneContent({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col items-center gap-3 text-center", className)}>{children}</div>;
}

export function DropzoneEmptyState({
  title = "Arrastra y suelta los archivos",
  description = "O haz clic para seleccionarlos",
  icon,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 text-sm text-muted-foreground", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon ?? <UploadCloud className="h-5 w-5" />}
      </div>
      <div className="space-y-1">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
