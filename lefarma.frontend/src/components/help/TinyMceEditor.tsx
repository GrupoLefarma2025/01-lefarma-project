import { useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';

interface TinyMceEditorProps {
  initialContent: string;
  onChange: (htmlContent: string) => void;
}

export default function TinyMceEditor({ initialContent, onChange }: TinyMceEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInitialized.current && initialContent) {
      editorRef.current.setContent(initialContent);
      isInitialized.current = true;
    }
  }, [initialContent]);

  return (
    <Editor
      apiKey="no-api-key"
      onInit={(_, editor) => {
        editorRef.current = editor;
      }}
      initialValue={initialContent || ''}
      init={{
        height: 400,
        menubar: false,
        plugins: [
          'advlist',
          'autolink',
          'lists',
          'link',
          'image',
          'charmap',
          'preview',
          'anchor',
          'searchreplace',
          'visualblocks',
          'code',
          'fullscreen',
          'insertdatetime',
          'media',
          'table',
          'help',
          'wordcount',
        ],
        toolbar:
          'fontsize | bold italic underline strikethrough | ' +
          'h1 h2 h3 | blockquote | code | ' +
          'bullist numlist | alignleft aligncenter alignright | ' +
          'link image | removeformat | help',
        fontsize_formats: '12px 14px 16px 18px 20px 24px 28px 32px',
        formats: {
          h1: { block: 'h1' },
          h2: { block: 'h2' },
          h3: { block: 'h3' },
          blockquote: { block: 'blockquote', wrapper: true },
          code: { block: 'pre', classes: 'bg-muted p-4 rounded overflow-x-auto' },
        },
        toolbar_mode: 'sliding',
        statusbar: false,
        promotion: false,
        branding: false,
        content_style: `
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            font-size: 14px; 
            line-height: 1.6;
            padding: 8px;
          }
          h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
          h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
          h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
          blockquote { 
            border-left: 4px solid #ccc; 
            margin: 1em 0; 
            padding-left: 1em; 
            color: #666;
          }
          pre { 
            background: #f4f4f5; 
            padding: 1em; 
            border-radius: 6px; 
            overflow-x: auto;
            font-family: monospace;
          }
          code { 
            background: #f4f4f5; 
            padding: 0.2em 0.4em; 
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
          }
          img { max-width: 100%; height: auto; border-radius: 6px; }
          ul, ol { padding-left: 1.5em; }
        `,
        file_picker_callback: (callback) => {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
              const response = await fetch('/api/help/images/upload', {
                method: 'POST',
                body: formData,
              });
              const data = await response.json();
              if (data.success && data.data) {
                callback(data.data.rutaRelativa, { alt: file.name });
              }
            } catch (error) {
              console.error('Error uploading image:', error);
            }
          };
          input.click();
        },
        images_upload_handler: async (blobInfo) => {
          const formData = new FormData();
          formData.append('file', blobInfo.blob(), blobInfo.filename());

          const response = await fetch('/api/help/images/upload', {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (data.success && data.data) {
            return data.data.rutaRelativa;
          }
          throw new Error('Error uploading image');
         },
       }}
      onEditorChange={(content) => {
        onChange(content);
      }}
    />
  );
}
