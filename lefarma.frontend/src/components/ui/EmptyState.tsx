import { cn } from "@/lib/utils"
import { FileX } from "lucide-react"

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({
  title = "Sin datos",
  description,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6 text-center select-none",
        className
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-muted rounded-full blur-xl opacity-40 scale-125" />
        <div className="relative bg-muted rounded-2xl p-4 text-muted-foreground/60">
          {icon ?? <FileX className="w-10 h-10" />}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-52 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
