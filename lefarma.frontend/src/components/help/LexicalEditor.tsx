import { useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ImageNode } from './nodes/ImageNode';
import { RichTextToolbar } from './RichTextToolbar';

interface LexicalEditorProps {
  initialContent: string;
  onChange: (serializedState: string) => void;
}

function InitialContentPlugin({ serializedState }: { serializedState: string }) {
  const [editor] = useLexicalComposerContext();
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }

    if (!serializedState) {
      return;
    }

    try {
      const parsedState = editor.parseEditorState(serializedState);
      editor.setEditorState(parsedState);
      didInitRef.current = true;
    } catch (error) {
      console.error('Error loading Lexical state:', error);
    }
  }, [editor, serializedState]);

  return null;
}

export default function LexicalEditor({ initialContent, onChange }: LexicalEditorProps) {
  const initialConfig = {
    namespace: 'HelpRichTextEditor',
    onError: (error: Error) => {
      console.error('Lexical editor error:', error);
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
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="rounded-md border bg-amber-50/30">
        <RichTextToolbar />
        <div className="p-4 min-h-[340px]">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-[300px] outline-none text-sm leading-6" />
            }
            placeholder={
              <div className="text-sm text-muted-foreground">
                Escribe el contenido del articulo aqui...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <InitialContentPlugin serializedState={initialContent} />
        <OnChangePlugin
          onChange={(editorState) => {
            onChange(JSON.stringify(editorState.toJSON()));
          }}
        />
      </div>
    </LexicalComposer>
  );
}
