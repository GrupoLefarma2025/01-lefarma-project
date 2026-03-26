import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ImageNode } from './nodes/ImageNode';

interface LexicalViewerProps {
  contenido: string;
}

export default function LexicalViewer({ contenido }: LexicalViewerProps) {
  const initialConfig = {
    namespace: 'HelpRichTextViewer',
    editable: false,
    onError: (error: Error) => {
      console.error('Lexical viewer error:', error);
    },
    theme: {
      paragraph: 'mb-3',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'rounded bg-muted px-1 py-0.5 font-mono text-sm',
      },
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, ImageNode],
    editorState: contenido,
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <ContentEditable className="min-h-[300px] outline-none text-sm leading-6" />
        }
        placeholder={<div className="text-sm text-muted-foreground" />}
        ErrorBoundary={LexicalErrorBoundary}
      />
    </LexicalComposer>
  );
}

