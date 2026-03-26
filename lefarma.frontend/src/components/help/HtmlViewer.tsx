interface HtmlViewerProps {
  contenido: string;
  className?: string;
}

export default function HtmlViewer({ contenido, className = '' }: HtmlViewerProps) {
  if (!contenido) {
    return (
      <div className="text-muted-foreground italic">
        Sin contenido
      </div>
    );
  }

  return (
    <div 
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: contenido }}
    />
  );
}
