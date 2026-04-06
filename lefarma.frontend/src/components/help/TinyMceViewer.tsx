
interface TinyMceViewerProps {
  contenido: string;
}

export default function TinyMceViewer({ contenido }: TinyMceViewerProps) {
  if (!contenido) {
    return (
      <div className="text-sm text-muted-foreground">
        Sin contenido
      </div>
    );
  }

  return (
    <div 
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: contenido }}
    />
  );
}
