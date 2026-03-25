import React from 'react';

interface LexicalTextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

interface LexicalElementNode {
  type: 'paragraph' | 'heading' | 'list' | 'listitem' | 'link' | 'quote';
  children: (LexicalTextNode | LexicalElementNode)[];
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  listType?: 'bullet' | 'number';
  url?: string;
  version?: number;
  direction?: 'ltr' | 'rtl' | null;
  format?: '' | 'left' | 'start' | 'center' | 'right' | 'end' | 'justify';
  indent?: number;
}

interface LexicalRoot {
  children: (LexicalTextNode | LexicalElementNode)[];
  direction?: 'ltr' | 'rtl' | null;
  format?: '' | 'left' | 'start' | 'center' | 'right' | 'end' | 'justify';
  indent?: number;
  type?: 'root';
}

interface LexicalJSON {
  root: LexicalRoot;
}

interface LexicalRendererProps {
  contenido: string;
}

/**
 * Renderer para contenido en formato Lexical JSON.
 * Convierte el JSON estructurado de Lexical en elementos React renderizables.
 */
export default function LexicalRenderer({ contenido }: LexicalRendererProps) {
  // Parse JSON and handle errors
  let lexicalData: LexicalJSON | null = null;
  try {
    lexicalData = JSON.parse(contenido);
  } catch (error) {
    console.error('Error parsing Lexical JSON:', error);
    return <p className="text-muted-foreground">Error al renderizar el contenido.</p>;
  }

  if (!lexicalData || !lexicalData.root || !lexicalData.root.children) {
    return <p className="text-muted-foreground">Contenido no válido.</p>;
  }

  // Render individual nodes
  const renderNode = (node: LexicalTextNode | LexicalElementNode, index: number): React.ReactNode => {
    // Text node
    if (node.type === 'text') {
      const textNode = node as LexicalTextNode;
      let content = textNode.text;

      // Apply text formatting
      if (textNode.bold) content = <strong key={index}>{content}</strong>;
      if (textNode.italic) content = <em key={index}>{content}</em>;
      if (textNode.underline) content = <u key={index}>{content}</u>;
      if (textNode.strikethrough) content = <s key={index}>{content}</s>;
      if (textNode.code) content = <code key={index} className="rounded bg-muted px-1 py-0.5 text-sm">{content}</code>;

      return content;
    }

    // Element nodes
    const elementNode = node as LexicalElementNode;
    const children = elementNode.children?.map((child, i) => renderNode(child, i)) || [];

    switch (elementNode.type) {
      case 'paragraph':
        return <p key={index} className="mb-4 last:mb-0">{children}</p>;

      case 'heading':
        const HeadingTag = elementNode.tag || 'h2';
        const headingClasses = {
          h1: 'text-3xl font-bold mb-4',
          h2: 'text-2xl font-bold mb-3',
          h3: 'text-xl font-bold mb-2',
          h4: 'text-lg font-bold mb-2',
          h5: 'text-base font-bold mb-2',
          h6: 'text-sm font-bold mb-2',
        };
        return React.createElement(
          HeadingTag,
          { key: index, className: headingClasses[elementNode.tag as keyof typeof headingClasses] || headingClasses.h2 },
          children
        );

      case 'list':
        const ListTag = elementNode.listType === 'number' ? 'ol' : 'ul';
        const listClass = elementNode.listType === 'number'
          ? 'list-decimal list-inside mb-4 space-y-2'
          : 'list-disc list-inside mb-4 space-y-2';
        return <ListTag key={index} className={listClass}>{children}</ListTag>;

      case 'listitem':
        return <li key={index}>{children}</li>;

      case 'link':
        return (
          <a
            key={index}
            href={elementNode.url}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        );

      case 'quote':
        return (
          <blockquote key={index} className="border-l-4 border-primary pl-4 italic my-4">
            {children}
          </blockquote>
        );

      default:
        // Unknown node type - render children
        return <span key={index}>{children}</span>;
    }
  };

  // Render all children of root
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      {lexicalData.root.children.map((node, index) => renderNode(node, index))}
    </div>
  );
}
