import { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
} from 'lexical';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
} from '@lexical/list';
import {
  $isHeadingNode,
  HeadingNode,
  $createHeadingNode,
} from '@lexical/rich-text';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $getNearestNodeOfType } from '@lexical/utils';
import { $setBlocksType } from '@lexical/selection';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link,
  ImageIcon,
  Undo,
  Redo,
  Pilcrow,
} from 'lucide-react';
import { ToolbarButton } from './ui/ToolbarButton';
import { ImageUploadDialog } from './ui/ImageUploadDialog';
import type { HelpImageUploadResponse } from '@/types/help.types';
import { $createImageNode } from './nodes/ImageNode';

type BlockType = 'paragraph' | 'h1' | 'h2' | 'quote' | 'code';

export function RichTextToolbar() {
  const [editor] = useLexicalComposerContext();
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [activeBlockType, setActiveBlockType] = useState<BlockType>('paragraph');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);

  // Update toolbar state based on current selection
  const updateToolbarState = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      // Update text format states
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));

      // Update block type
      const anchorNode = selection.anchor.getNode();
      let blockType: BlockType = 'paragraph';

      // Check for heading
      if ($isHeadingNode(anchorNode)) {
        const tag = anchorNode.getTag();
        if (tag === 'h1') blockType = 'h1';
        else if (tag === 'h2') blockType = 'h2';
      }
      // Check for list
      else if ($isListNode(anchorNode)) {
        blockType = anchorNode.getTag() === 'ul' ? 'paragraph' : 'paragraph';
      }
      // Check parent for heading/list
      else {
        const headingParent = $getNearestNodeOfType(anchorNode, HeadingNode);
        if (headingParent) {
          const tag = headingParent.getTag();
          if (tag === 'h1') blockType = 'h1';
          else if (tag === 'h2') blockType = 'h2';
        }
      }

      setActiveBlockType(blockType);
    });
  }, [editor]);

  // Register update listener
  useEffect(() => {
    return editor.registerUpdateListener(() => {
      updateToolbarState();
    });
  }, [editor, updateToolbarState]);

  // Format text handlers
  const handleBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const handleItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const handleUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const handleStrikethrough = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
  };

  const handleCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  // History handlers
  const handleUndo = () => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  };

  const handleRedo = () => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  };

  // Block type handler
  const handleBlockTypeChange = (newBlockType: BlockType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      switch (newBlockType) {
        case 'paragraph':
          $setBlocksType(selection, () => $createParagraphNode());
          break;
        case 'h1':
          $setBlocksType(selection, () => $createHeadingNode('h1'));
          break;
        case 'h2':
          $setBlocksType(selection, () => $createHeadingNode('h2'));
          break;
        case 'quote':
          // Quote will be handled by QuoteNode (Task 11)
          $setBlocksType(selection, () => $createParagraphNode());
          break;
        case 'code':
          // Code block will be handled by CodeNode (Task 11)
          $setBlocksType(selection, () => $createParagraphNode());
          break;
      }

      setActiveBlockType(newBlockType);
    });
  };

  // List handlers
  const handleBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const handleNumberedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  // Link handler
  const handleLink = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      const url = prompt('Ingresa la URL del enlace:');
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, target: '_blank' });
      }
    });
  };

  // Image handler
  const handleImageInsert = (response: HelpImageUploadResponse) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }

      const imageNode = $createImageNode({
        src: response.rutaRelativa,
        altText: response.nombreOriginal,
      });
      selection.insertNodes([imageNode]);
    });
    setIsImageDialogOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30 rounded-t-md">
        {/* History group */}
        <div className="flex items-center gap-0.5 pr-2 border-r">
          <ToolbarButton onClick={handleUndo} tooltip="Deshacer">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleRedo} tooltip="Rehacer">
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Block type group */}
        <div className="flex items-center gap-0.5 px-2 border-r">
          <ToolbarButton
            onClick={() => handleBlockTypeChange('paragraph')}
            isActive={activeBlockType === 'paragraph'}
            tooltip="Parrafo"
          >
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => handleBlockTypeChange('h1')}
            isActive={activeBlockType === 'h1'}
            tooltip="Titulo 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => handleBlockTypeChange('h2')}
            isActive={activeBlockType === 'h2'}
            tooltip="Titulo 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => handleBlockTypeChange('quote')}
            isActive={activeBlockType === 'quote'}
            tooltip="Cita"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => handleBlockTypeChange('code')}
            isActive={activeBlockType === 'code'}
            tooltip="Bloque de codigo"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Text formatting group */}
        <div className="flex items-center gap-0.5 px-2 border-r">
          <ToolbarButton onClick={handleBold} isActive={isBold} tooltip="Negrita">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleItalic} isActive={isItalic} tooltip="Cursiva">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={handleUnderline}
            isActive={isUnderline}
            tooltip="Subrayado"
          >
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={handleStrikethrough}
            isActive={isStrikethrough}
            tooltip="Tachado"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleCode} isActive={isCode} tooltip="Codigo inline">
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Lists group */}
        <div className="flex items-center gap-0.5 px-2 border-r">
          <ToolbarButton onClick={handleBulletList} tooltip="Lista con viñetas">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleNumberedList} tooltip="Lista numerada">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Insert group */}
        <div className="flex items-center gap-0.5 pl-2">
          <ToolbarButton onClick={handleLink} tooltip="Insertar enlace">
            <Link className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setIsImageDialogOpen(true)}
            tooltip="Insertar imagen"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Image Upload Dialog */}
      <ImageUploadDialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
        onImageInserted={handleImageInsert}
      />
    </>
  );
}

export default RichTextToolbar;
