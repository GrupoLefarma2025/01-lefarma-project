import { useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import type { Editor as TinyMCEEditor } from 'tinymce';
import { CHIP_CLASS, convertirVariablesAChips, crearChipVariable, normalizarVariables } from './emailTemplateVariables';

interface EmailTemplateEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables: string[];
  height?: number | string;
}

export function EmailTemplateEditor({
  value,
  onChange,
  variables,
  height = 320,
}: EmailTemplateEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [initialValue] = useState(() => convertirVariablesAChips(value, variables));

  const insertarVariable = (variable: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.insertContent(crearChipVariable(variable) + '&nbsp;');
  };

  return (
    <div className="space-y-2">
      <div className="min-h-0 rounded-md border border-input">
        <Editor
          apiKey="1y98o7v8qkqc9big87lvk4ekuo85bc6xrxzgue0jlmv5ip57"
          onInit={(_, editor) => {
            editorRef.current = editor;
          }}
          initialValue={initialValue}
          init={{
            height,
            resize: false,
            menubar: false,
            statusbar: false,
            branding: false,
            promotion: false,
            plugins: ['lists', 'link', 'autolink', 'noneditable'],
            toolbar:
              'bold italic underline | bullist numlist | link | removeformat',
            valid_elements: 'p,strong,em,ul,ol,li,br,a[href|target],span[class|data-variable]',
            extended_valid_elements: 'span[class|data-variable]',
            noneditable_noneditable_class: CHIP_CLASS,
            valid_classes: {
              '*': CHIP_CLASS,
            },
            content_style: `
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                padding: 12px;
                margin: 0;
              }
              p { margin: 0 0 0.75em; }
              ul, ol { padding-left: 1.5em; margin: 0 0 0.75em; }
              .${CHIP_CLASS} {
                display: inline-block;
                background-color: #e0f2fe;
                color: #0369a1;
                border: 1px solid #7dd3fc;
                border-radius: 9999px;
                padding: 2px 8px;
                font-size: 0.85em;
                font-weight: 500;
                cursor: default;
                user-select: none;
                vertical-align: middle;
                line-height: 1.2;
              }
            `,
          }}
          onEditorChange={(content) => {
            onChange(normalizarVariables(content));
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {variables.map((variable) => (
          <button
            key={variable}
            type="button"
            onClick={() => insertarVariable(variable)}
            className="inline-flex cursor-pointer items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200 transition-colors hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-900"
            title={`Insertar {{${variable.replace(/^\{\{|\}\}$/g, '')}}}`}
          >
            {variable.replace(/^\{\{|\}\}$/g, '')}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmailTemplateEditor;
