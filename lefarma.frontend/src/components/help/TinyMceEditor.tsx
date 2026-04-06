import { useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';
import { authService } from '@/services/authService';


interface TinyMceEditorProps {
  initialContent: string;
  onChange: (htmlContent: string) => void;
  height?: string | number;
}

export default function TinyMceEditor({ initialContent, onChange, height }: TinyMceEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const isInitialized = useRef(false);
  const isSettingContent = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInitialized.current && initialContent) {
      isSettingContent.current = true;
      editorRef.current.setContent(initialContent);
      isInitialized.current = true;
      setTimeout(() => {
        isSettingContent.current = false;
      }, 0);
    }
  }, [initialContent]);

  const editorHeight = height ?? 'calc(100vh - 14rem)';

  return (
    <div 
      className="h-full min-h-0" 
      style={{ height: editorHeight }}
    >
      <Editor
        apiKey='1y98o7v8qkqc9big87lvk4ekuo85bc6xrxzgue0jlmv5ip57'
        onInit={(_, editor) => {
          editorRef.current = editor;
        }}
        initialValue={initialContent || ''}
        init={{
          height: '100%',
          resize: true,
          min_height: 400,
          menubar: false,
          plugins: [
            'anchor',
            'autolink',
            'charmap',
            'codesample',
            'emoticons',
            'image',
            'link',
            'lists',
            'media',
            'searchreplace',
            'table',
            'visualblocks',
            'wordcount',
          ],
          toolbar:
            'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | ' +
            'link image table | align lineheight | numlist bullist indent outdent | ' +
            'emoticons charmap | removeformat',
          images_upload_handler: async (blobInfo) => {
            const formData = new FormData();
            formData.append('file', blobInfo.blob(), blobInfo.filename());

            const token = authService.getAccessToken();
            const response = await fetch('/api/help/images', {
              method: 'POST',
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Error al subir la imagen');
            }

            const result = await response.json();
            return result.data?.rutaRelativa;
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
        }}
        onEditorChange={(content) => {
          if (!isSettingContent.current) {
            onChange(content);
          }
        }}
      />
    </div>
  );
}
