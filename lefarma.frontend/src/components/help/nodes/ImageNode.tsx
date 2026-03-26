import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Suspense, useCallback, useRef, useState } from 'react';
import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ImagePayload {
  altText: string;
  height?: number;
  key?: NodeKey;
  src: string;
  width?: number;
}

export type SerializedImageNode = Spread<
  {
    altText: string;
    height?: number;
    src: string;
    width?: number;
    type: 'image';
    version: 1;
  },
  SerializedLexicalNode
>;

// ============================================================================
// ImageNode Class
// ============================================================================

export class ImageNode extends DecoratorNode<React.JSX.Element> {
  __src: string;
  __altText: string;
  __width?: number;
  __height?: number;

  constructor(
    src: string,
    altText: string = '',
    width?: number,
    height?: number,
    key?: NodeKey
  ) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__width = width;
    this.__height = height;
  }

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__key
    );
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'my-2';
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  setSrc(src: string): void {
    const writable = this.getWritable();
    writable.__src = src;
  }

  setAltText(altText: string): void {
    const writable = this.getWritable();
    writable.__altText = altText;
  }

  setWidthAndHeight(width: number | undefined, height: number | undefined): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { altText, height, src, width } = serializedNode;
    const node = $createImageNode({
      altText,
      height,
      src,
      width,
    });
    return node;
  }

  exportJSON(): SerializedImageNode {
    return {
      altText: this.__altText,
      height: this.__height,
      src: this.__src,
      type: 'image',
      version: 1,
      width: this.__width,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 1,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);
    if (this.__width) {
      element.setAttribute('width', String(this.__width));
    }
    if (this.__height) {
      element.setAttribute('height', String(this.__height));
    }
    return { element };
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.JSX.Element {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center rounded-md border bg-muted p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <ImageComponent
          src={this.__src}
          altText={this.__altText}
          width={this.__width}
          height={this.__height}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

// ============================================================================
// Type Guard
// ============================================================================

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}

// ============================================================================
// ImageComponent (must be after ImageNode class definition)
// ============================================================================

function ImageComponent({
  src,
  altText,
  width,
  height,
  nodeKey,
}: {
  altText: string;
  height?: number;
  nodeKey: NodeKey;
  src: string;
  width?: number;
}): React.JSX.Element {
  const [editor] = useLexicalComposerContext();
  // Track which src caused an error - derived state pattern avoids useEffect setState
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Derived error state: only true if error src matches current src
  const hasError = errorSrc === src;

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && $isImageNode(node)) {
          // Select the node using native Lexical selection
          const selection = editor.getEditorState().read(() => {
            return node.getKey();
          });
          if (selection) {
            editor.update(() => {
              const writableNode = node.getWritable();
              // Mark as selected via writable pattern
            });
          }
        }
      });
    },
    [editor, nodeKey]
  );

  const handleError = useCallback(() => {
    setErrorSrc(src);
  }, [src]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        <p className="mt-2 text-sm">No se pudo cargar la imagen</p>
        {altText && <p className="mt-1 text-xs text-muted-foreground">{altText}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <img
        ref={imageRef}
        src={src}
        alt={altText}
        width={width}
        height={height}
        onClick={handleClick}
        onError={handleError}
        className="max-w-full rounded-md border cursor-pointer hover:opacity-90 transition-opacity"
        style={{
          height: height ? `${height}px` : 'auto',
          width: width ? `${width}px` : 'auto',
        }}
        draggable={false}
      />
      {altText && (
        <p className="mt-1 text-xs text-muted-foreground text-center">{altText}</p>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function convertImageElement(domNode: HTMLElement): DOMConversionOutput | null {
  const src = domNode.getAttribute('src');
  const altText = domNode.getAttribute('alt') || '';
  const width = domNode.getAttribute('width');
  const height = domNode.getAttribute('height');

  if (src) {
    const node = $createImageNode({
      altText,
      height: height ? parseInt(height, 10) : undefined,
      src,
      width: width ? parseInt(width, 10) : undefined,
    });
    return { node };
  }

  return null;
}

export function $createImageNode({
  altText,
  height,
  src,
  width,
  key,
}: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(src, altText, width, height, key)
  );
}
