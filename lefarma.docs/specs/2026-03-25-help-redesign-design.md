# Help Module Redesign — Technical Design Document

**Status:** Approved
**Created:** 2026-03-25
**Author:** Design Phase Sub-agent
**Project:** 01-lefarma-project

---

## 1. Problem Statement

The current Help module has several UX and architectural issues:

1. **Cluttered Layout:** The main page displays both a content preview panel AND a grid of article cards (`HelpCard` components), creating visual noise and redundant navigation paths.

2. **Ineffective Type Toggle:** The `Usuario`/`Sistemas` switch exists but doesn't fully replace the content area — it only filters the sidebar and cards while keeping the same layout structure.

3. **No Rich Editor Toolbar:** The `LexicalEditor` component is a bare-bones implementation with no visible toolbar. Users cannot format text, insert headings, lists, links, or images without keyboard shortcuts.

4. **No Image Support:** While the backend has a `HelpImage` entity and database table, there's no upload endpoint, no frontend upload flow, and images cannot be inserted into articles.

5. **Disconnected Editor Experience:** The `HelpEditor.tsx` page uses a raw JSON textarea for content editing instead of the Lexical visual editor.

---

## 2. Goals

| # | Goal | Success Metric |
|---|------|----------------|
| 1 | Remove article cards/preview blocks from Help landing | Single content area, no grid of cards |
| 2 | Sidebar-oriented layout with clear navigation | Sidebar remains, content area dominates |
| 3 | Top selector + switch that fully replaces content | Toggle between Usuario/Sistemas swaps entire content view |
| 4 | Rich editor with visible toolbar | Toolbar with 10+ formatting options visible at all times |
| 5 | Image upload to backend with DB persistence | Images stored in `HelpImages` table, served via API |
| 6 | Viewer compatibility with saved content | All editor features render correctly in read mode |

---

## 3. Non-Goals

- **Full Lexical rewrite:** We will enhance the existing editor, not rebuild from scratch.
- **Real-time collaboration:** Single-user editing only.
- **Version history:** No article versioning in this phase.
- **Comments/annotations:** Future consideration.
- **Search within articles:** Out of scope.
- **Mobile-responsive Help:** Desktop-first for now.

---

## 4. Current-State Findings

### 4.1 Frontend Structure

```
lefarma.frontend/src/
├── pages/help/
│   ├── HelpList.tsx      # Main page (sidebar + cards grid + content panel)
│   ├── HelpEditor.tsx    # Separate editor page with JSON textarea
│   └── HelpView.tsx      # View-only page
├── components/help/
│   ├── HelpSidebar.tsx   # Module/Type navigation
│   ├── HelpCard.tsx      # Article preview card (TO BE REMOVED)
│   ├── LexicalEditor.tsx # Basic editor, NO toolbar
│   ├── LexicalViewer.tsx # Read-only viewer
│   └── LexicalRenderer.tsx # Alternative JSON renderer
├── store/helpStore.ts    # Zustand store
├── services/helpService.ts # API client
└── types/help.types.ts   # TypeScript types
```

### 4.2 Lexical Editor Current State

**File:** `LexicalEditor.tsx` (82 lines)

```typescript
// Current implementation - MINIMAL
<LexicalComposer initialConfig={initialConfig}>
  <RichTextPlugin
    contentEditable={<ContentEditable />}
    placeholder={...}
    ErrorBoundary={LexicalErrorBoundary}
  />
  <HistoryPlugin />
  <InitialContentPlugin />
  <OnChangePlugin />
</LexicalComposer>
```

**Missing:**
- No toolbar plugin
- No `ListPlugin`, `CheckListPlugin`
- No `LinkPlugin`
- No `ImagePlugin` or custom image handling
- No `HeadingPlugin` (relies on default)
- No `CodeHighlightPlugin`
- No `AutoFocusPlugin`
- No `TabIndentationPlugin`

### 4.3 Backend Structure

**Entities:**
- `HelpArticle` — `Id`, `Titulo`, `Contenido` (Lexical JSON), `Resumen`, `Modulo`, `Tipo`, `Categoria`, `Orden`, `Activo`, timestamps
- `HelpImage` — `Id`, `NombreOriginal`, `NombreArchivo`, `RutaRelativa`, `TamanhoBytes`, `MimeType`, `Ancho`, `Alto`, `FechaSubida`, `SubidoPor`

**API Endpoints (existing):**
- `GET /api/help/articles` — List all
- `GET /api/help/articles/{id}` — Get by ID
- `GET /api/help/articles/by-module/{modulo}` — Filter by module
- `GET /api/help/articles/by-type/{tipo}` — Filter by type
- `POST /api/help/articles` — Create (requires Administrator/Manager)
- `PUT /api/help/articles/{id}` — Update
- `DELETE /api/help/articles/{id}` — Delete (requires Administrator)

**Missing:**
- `POST /api/help/images` — Upload image
- `GET /api/help/images/{filename}` — Serve image

### 4.4 Dependencies

```json
// package.json
"@lexical/react": "^0.42.0",
"lexical": "^0.42.0"
```

No additional Lexical plugins installed (e.g., `@lexical/code`, `@lexical/list`, `@lexical/link`, `@lexical/rich-text`).

---

## 5. Proposed UX Layout

### 5.1 New HelpList Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Sidebar (w-64)]  │           Main Content Area                │
│                    │  ┌───────────────────────────────────────┐  │
│  ┌──────────────┐  │  │  Header                               │  │
│  │ Todos        │  │  │  ┌─────────────────┬───────────────┐  │  │
│  │ ──────────── │  │  │  │ Centro de Ayuda │ [Usuario][🔴] │  │  │
│  │ MÓDULOS      │  │  │  └─────────────────┴───────────────┘  │  │
│  │ • General    │  │  │                                       │  │
│  │ • Catálogos  │  │  │  ┌─────────────────────────────────┐  │  │
│  │ • Auth       │  │  │  │                                 │  │  │
│  │ • Notificac. │  │  │  │     Article Content            │  │  │
│  │ • Perfil     │  │  │  │     (Viewer or Editor)         │  │  │
│  │ • Admin      │  │  │  │                                 │  │  │
│  │ • Config     │  │  │  │                                 │  │  │
│  │              │  │  │  │                                 │  │  │
│  │ TIPO         │  │  │  │                                 │  │  │
│  │ • Usuario    │  │  │  └─────────────────────────────────┘  │  │
│  │ • Sistemas   │  │  │                                       │  │
│  │ • Ambos      │  │  │  [Editar] [Guardar] [Cancelar]        │  │
│  └──────────────┘  │  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Key Changes:
- NO article cards grid at the bottom
- Type switch (Usuario/Sistemas) in header REPLACES content
- Single article view, not a preview panel + cards
```

### 5.2 Type Switch Behavior

| Switch Position | Articles Loaded | Content Area Shows |
|-----------------|-----------------|-------------------|
| Usuario (off) | `tipo=usuario` OR `tipo=ambos` | First matching article |
| Sistemas (on) | `tipo=desarrollador` | First matching article |

**Implementation Options for Usuario View (merged filter):**

| Option | Approach | Recommendation |
|--------|----------|----------------|
| **A: Merged Client Calls** | Fetch both `tipo=usuario` and `tipo=ambos` endpoints, merge results client-side | Simple but two requests |
| **B: New Backend Endpoint** | Add `GET /api/help/articles/for-user` that returns `tipo IN ('usuario', 'ambos')` | **RECOMMENDED** — cleaner API, single request |

**Recommended: Option B (New Backend Endpoint)**

```http
GET /api/help/articles/for-user?modulo={modulo}
```

Returns articles where `tipo='usuario'` OR `tipo='ambos'`, filtered by módulo if provided. This keeps the frontend simple with a single API call and centralizes the filter logic in the backend.

The switch triggers a **full content swap**:
1. Clear current article selection
2. Fetch articles by new type (using `/for-user` for Usuario, `/by-type/desarrollador` for Sistemas)
3. Load first article into content area
4. Reset editing state to view mode

### 5.3 Empty State Handling

When no articles match the selected módulo/tipo combination, display an empty state instead of blank content:

```
┌─────────────────────────────────────────────────────────────────┐
│  [Sidebar]         │           Empty State                      │
│                    │  ┌───────────────────────────────────────┐  │
│                    │  │                                       │  │
│                    │  │     📄 No hay artículos               │  │
│                    │  │                                       │  │
│                    │  │     No se encontraron artículos para  │  │
│                    │  │     "Catálogos" en modo "Usuario".    │  │
│                    │  │                                       │  │
│                    │  │     [ + Crear artículo ]              │  │
│                    │  │                                       │  │
│                    │  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Empty State Requirements:**

| Requirement | Implementation |
|-------------|----------------|
| Contextual message | Display módulo name and tipo in message |
| Create CTA | Show "Crear artículo" button only if user has permission |
| Permission check | Use `authStore.user.roles` — require `Administrator` or `Manager` role |
| Pre-fill form | When clicking CTA, pre-select the current módulo and tipo in the new article form |

**Permission Check (Frontend):**

```typescript
const canCreateArticle = useMemo(() => {
  const user = authStore.getState().user;
  return user?.roles?.some(r => r === 'Administrator' || r === 'Manager') ?? false;
}, []);
```

### 5.4 Editor Mode Layout

When user clicks "Editar":

```
┌─────────────────────────────────────────────────────────────────┐
│  [Sidebar]         │           Editor Area                      │
│                    │  ┌───────────────────────────────────────┐  │
│                    │  │  ┌─────────────────────────────────┐  │  │
│                    │  │  │ [B][I][U][S] [H1][H2][P]        │  │  │
│                    │  │  │ [•][1.] ["] [</>] [🔗] [🖼️]     │  │  │
│                    │  │  └─────────────────────────────────┘  │  │
│                    │  │                                       │  │
│                    │  │  ┌─────────────────────────────────┐  │  │
│                    │  │  │                                 │  │  │
│                    │  │  │     Lexical ContentEditable     │  │  │
│                    │  │  │                                 │  │  │
│                    │  │  │                                 │  │  │
│                    │  │  └─────────────────────────────────┘  │  │
│                    │  │                                       │  │
│                    │  │  [Guardar] [Cancelar]                 │  │
│                    │  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Editor Architecture Approach

### 6.1 Option A: Controlled Enhancement (CHOSEN)

**Rationale:** The existing `LexicalEditor.tsx` is only 82 lines and follows Lexical patterns correctly. Enhancing it is lower risk than a rewrite.

**Implementation Strategy:**

1. **Add Toolbar Component** — New `RichTextToolbar.tsx` with button groups
2. **Install Missing Lexical Plugins:**
   ```bash
   npm install @lexical/list @lexical/link @lexical/code @lexical/rich-text
   ```
3. **Register Nodes and Plugins:**
   - `ListNode`, `ListItemNode` — for bullet/numbered lists
   - `HeadingNode` — explicit heading support
   - `LinkNode` — for hyperlinks
   - `AutoLinkNode` — auto-detect URLs
   - `CodeNode`, `CodeHighlightNode` — for code blocks
   - `ImageNode` (custom) — for uploaded images

4. **Image Upload Flow:**
   - Toolbar button opens file picker
   - File uploaded via `POST /api/help/images`
   - Response includes `rutaRelativa`
   - Insert `ImageNode` with `src` pointing to API route

5. **Theme Enhancement:**
   ```typescript
   const theme = {
     paragraph: 'mb-4 leading-7',
     text: {
       bold: 'font-bold',
       italic: 'italic',
       underline: 'underline',
       strikethrough: 'line-through',
       code: 'bg-muted px-1.5 py-0.5 rounded font-mono text-sm',
       underlineStrikethrough: 'underline line-through',
     },
     heading: {
       h1: 'text-3xl font-bold mb-4 mt-6',
       h2: 'text-2xl font-bold mb-3 mt-5',
       h3: 'text-xl font-bold mb-2 mt-4',
       h4: 'text-lg font-bold mb-2 mt-3',
     },
     list: {
       ul: 'list-disc pl-6 mb-4 space-y-1',
       ol: 'list-decimal pl-6 mb-4 space-y-1',
       listitem: 'leading-7',
     },
     quote: 'border-l-4 border-primary pl-4 italic my-4',
     code: 'bg-muted p-4 rounded-lg font-mono text-sm block overflow-x-auto',
     link: 'text-primary underline underline-offset-4 hover:text-primary/80',
   };
   ```

### 6.2 Toolbar Feature Matrix

| Button | Format | Lexical Mechanism | Implementation |
|--------|--------|-------------------|----------------|
| **B** | Bold | `FORMAT_TEXT_COMMAND` | `$getSelection(), $setBlocksType` |
| **I** | Italic | `FORMAT_TEXT_COMMAND` | Built-in |
| **U** | Underline | `FORMAT_TEXT_COMMAND` | Built-in |
| **S** | Strikethrough | `FORMAT_TEXT_COMMAND` | Built-in |
| **H1** | Heading 1 | `$createHeadingNode` | `HeadingNode` |
| **H2** | Heading 2 | `$createHeadingNode` | `HeadingNode` |
| **P** | Paragraph | `$createParagraphNode` | Built-in |
| **•** | Bullet list | `INSERT_UNORDERED_LIST_COMMAND` | `ListPlugin` |
| **1.** | Numbered list | `INSERT_ORDERED_LIST_COMMAND` | `ListPlugin` |
| **"** | Quote | `$createQuoteNode` | `QuoteNode` |
| **</>** | Code block | `$createCodeNode` | `CodeNode` |
| **🔗** | Link | `$createLinkNode` | `LinkPlugin` + dialog |
| **🖼️** | Image | Custom `ImageNode` | Upload + insert |

---

## 7. Backend/API/Storage Expectations

### 7.1 New Image Upload Endpoint

```http
POST /api/help/images
Content-Type: multipart/form-data
Authorization: Bearer <token>

Request:
  file: <binary>
  alt?: string (optional alt text)

Response (201 Created):
{
  "success": true,
  "message": "Imagen subida exitosamente.",
  "data": {
    "id": 1,
    "nombreOriginal": "screenshot.png",
    "nombreArchivo": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
    "rutaRelativa": "/media/help/2026/03/a1b2c3d4.png",
    "tamanhoBytes": 45678,
    "mimeType": "image/png",
    "ancho": 800,
    "alto": 600,
    "fechaSubida": "2026-03-25T10:30:00Z"
  }
}
```

### 7.2 Image Serving Endpoint

```http
GET /api/help/images/{filename}
Authorization: Bearer <token> (optional, depends on policy)

Response:
  Content-Type: image/png (or appropriate MIME)
  Content-Length: <size>
  Cache-Control: public, max-age=31536000
  Body: <binary image data>
```

### 7.3 Storage Strategy

**PRIMARY RECOMMENDATION: Static File Serving via Middleware**

Use ASP.NET Core's built-in static files middleware for the initial implementation. This is the simplest, most performant approach:

```csharp
// In Program.cs
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(builder.Environment.WebRootPath, "media")),
    RequestPath = "/media",
    OnPrepareResponse = ctx =>
    {
        // Optional: Add caching headers
        ctx.Context.Response.Headers.Append(
            "Cache-Control", "public,max-age=31536000");
    }
});
```

**Storage Location:**

```
wwwroot/
└── media/
    └── help/
        └── 2026/
            └── 03/
                └── a1b2c3d4-e5f6-7890-abcd-ef1234567890.png
```

- Files stored under `wwwroot/media/help/{year}/{month}/{guid}.{ext}`
- `RutaRelativa` stored in DB: `/media/help/2026/03/abc123.png`
- **Served directly by Kestrel/IIS static files middleware** — no controller action needed
- Browser caches images for 1 year (immutable content with unique GUIDs)

**Why Static Files Middleware:**

| Factor | Static Middleware | Dedicated Endpoint |
|--------|------------------|-------------------|
| Performance | ✅ Highly optimized | ⚠️ Adds controller overhead |
| Caching | ✅ Built-in, configurable | ⚠️ Manual header management |
| Complexity | ✅ Minimal code | ⚠️ More boilerplate |
| Auth | ⚠️ Public (no auth) | ✅ Can require auth |

**Note:** Help images are **publicly accessible** by design (help content is not sensitive). If authentication is required in the future, migrate to a dedicated endpoint.

**Future Option: Cloud Storage**

For production scale, consider Azure Blob Storage or AWS S3:
- `RutaRelativa` contains full URL or relative path to blob
- Requires additional configuration for credentials
- Migration path: Update `RutaRelativa` format, no frontend changes needed

### 7.4 File Validation

```csharp
// Backend validation rules
public class ImageUploadValidator
{
    public static readonly string[] AllowedMimeTypes = 
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp"
    };

    public const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB
    public const int MaxWidth = 2000;
    public const int MaxHeight = 2000;
}
```

---

## 8. Data Flow: Upload → Insert → Save → Render

### 8.1 Sequence Diagram

```
User                Editor              Frontend            Backend             DB
  │                   │                    │                   │                 │
  │──Click 🖼️────────>│                    │                   │                 │
  │                   │──Open file picker─>│                   │                 │
  │<──────────────────│                    │                   │                 │
  │──Select file──────>│                    │                   │                 │
  │                   │──onChange(file)────>│                   │                 │
  │                   │                    │──POST /images────>│                 │
  │                   │                    │                   │──INSERT────────>│
  │                   │                    │<──201 + rutaRelativa│                 │
  │                   │<──{src: rutaRelativa}│                   │                 │
  │                   │──$createImageNode()│                   │                 │
  │                   │──insert nodes──────│                   │                 │
  │<──Image visible───│                    │                   │                 │
  │                   │                    │                   │                 │
  │──Click Guardar───>│                    │                   │                 │
  │                   │──onChange(JSON)────>│                   │                 │
  │                   │                    │──PUT /articles───>│                 │
  │                   │                    │                   │──UPDATE────────>│
  │                   │                    │<──200 OK──────────│                 │
  │<──Toast success───│                    │                   │                 │
  │                   │                    │                   │                 │
  │──View article─────>│                    │                   │                 │
  │                   │                    │──GET /articles───>│                 │
  │                   │                    │<──Contenido JSON──│                 │
  │                   │<──{contenido}──────│                   │                 │
  │                   │──Parse & render────│                   │                 │
  │<──Image rendered──│                    │                   │                 │
  │   (GET /images/{filename})─────────────>───────────────────>│──SELECT────────>│
  │<──────────────────│<───────binary──────│<──────────────────│                 │
```

### 8.2 Lexical Image Node JSON Structure

```json
{
  "type": "image",
  "version": 1,
  "src": "/media/help/2026/03/a1b2c3d4.png",
  "altText": "Screenshot del formulario",
  "width": 800,
  "height": 600,
  "direction": null,
  "format": "left"
}
```

### 8.3 Stored Article Content Example

```json
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "heading",
        "tag": "h2",
        "children": [{ "type": "text", "text": "Cómo crear un catálogo" }]
      },
      {
        "type": "paragraph",
        "children": [{ "type": "text", "text": "Sigue estos pasos:" }]
      },
      {
        "type": "list",
        "listType": "bullet",
        "children": [
          {
            "type": "listitem",
            "children": [{ "type": "text", "text": "Ve a Catálogos > General" }]
          },
          {
            "type": "listitem",
            "children": [{ "type": "text", "text": "Haz clic en Nuevo" }]
          }
        ]
      },
      {
        "type": "image",
        "src": "/media/help/2026/03/abc123.png",
        "altText": "Botón Nuevo",
        "width": 400,
        "height": 200
      }
    ]
  }
}
```

---

## 9. Risks & Tradeoffs

### 9.1 Option A (Controlled Enhancement) Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Lexical version compatibility** | Medium | Lock to `0.42.0`, test plugins thoroughly |
| **Custom ImageNode complexity** | Medium | Start with basic inline image, defer advanced features |
| **Toolbar state sync** | Low | Use `$getSelection()` in `useEffect` with debounce |
| **Bundle size increase** | Low | ~50KB gzipped for all plugins, acceptable |

### 9.2 Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| File system storage | Simpler but less scalable than cloud |
| No image optimization | Faster implementation, may affect load times |
| Single image size | No responsive images initially |
| Inline images only | No floating/wrapping text around images |

### 9.3 Migration Concerns

- **Existing articles:** Already stored as Lexical JSON, compatible with enhanced editor
- **No schema changes:** `HelpArticle.Contenido` already stores JSON
- **Backward compatibility:** Viewer already handles unknown node types gracefully

---

## 10. Implementation Phases

### Phase 1: Layout Cleanup (1-2 hours)
- [ ] Remove `HelpCard` grid from `HelpList.tsx`
- [ ] Remove `HelpCard` component import
- [ ] Ensure sidebar + content area fills viewport
- [ ] Test navigation flow

### Phase 2: Type Switch Full Replacement (1-2 hours)
- [ ] Update `handleToggleDocType` to clear and reload content
- [ ] Remove any residual card rendering logic
- [ ] Ensure switch state persists across module changes
- [ ] Add visual feedback during content swap

### Phase 3: Toolbar Component (2-3 hours)
- [ ] Create `RichTextToolbar.tsx` with button groups
- [ ] Implement button active state detection
- [ ] Add keyboard shortcut tooltips
- [ ] Style with Tailwind + shadcn/ui components

### Phase 4: Lexical Plugins Integration (3-4 hours)
- [ ] Install missing packages: `@lexical/list`, `@lexical/link`, `@lexical/code`
- [ ] Register nodes in `initialConfig`
- [ ] Add plugins: `ListPlugin`, `LinkPlugin`, `CodeHighlightPlugin`
- [ ] Update theme with comprehensive styles

### Phase 5: Custom Image Node (3-4 hours)
- [ ] Create `ImageNode.tsx` extending `DecoratorNode`
- [ ] Implement serialization/deserialization
- [ ] Add image upload dialog component
- [ ] Handle paste/drop of images (optional)

> **Technical Reference:** See [Lexical Playground ImageNode](https://github.com/facebook/lexical/tree/main/packages/lexical-playground/src/nodes/ImageNode.tsx) for a production-ready implementation pattern. The playground demonstrates proper node serialization, decorator component rendering, and image upload handling.

### Phase 6: Backend Image Upload (2-3 hours)
- [ ] Create `HelpImagesController` with `POST /api/help/images`
- [ ] Implement file storage service
- [ ] Add image serving endpoint or static file config
- [ ] Add validation and error handling

### Phase 7: Frontend Upload Flow (2-3 hours)
- [ ] Add `uploadImage` to `helpService.ts`
- [ ] Connect toolbar button to upload flow
- [ ] Insert image node on successful upload
- [ ] Add upload progress indicator

### Phase 8: Viewer Compatibility (1-2 hours)
- [ ] Update `LexicalViewer.tsx` with same node registrations
- [ ] Test all content types render correctly
- [ ] Verify images load via API route
- [ ] Handle broken images gracefully

### Phase 9: Polish & Testing (2-3 hours)
- [ ] Add loading states for all async operations
- [ ] Error boundary for editor crashes
- [ ] Accessibility audit (keyboard nav, ARIA)
- [ ] Cross-browser testing

---

## 11. Approval Summary

This design document captures the approved Help module redesign with the following key decisions:

| Decision | Approved Option |
|----------|-----------------|
| **Article cards** | REMOVE from landing page |
| **Layout** | Sidebar + full-width content area |
| **Type switch** | REPLACES main content completely |
| **Editor approach** | Option A — enhance existing Lexical editor |
| **Toolbar** | Visible, 10+ formatting options |
| **Image storage** | Backend file system + `HelpImages` table |
| **Viewer** | Must remain compatible with all editor content |

**Estimated Total Effort:** 17-26 hours across 9 phases

**Next Steps:**
1. User reviews this design document
2. Create implementation tasks in task tracker
3. Begin Phase 1: Layout Cleanup

---

## 12. Appendix: File Changes Summary

### Files to Modify

| File | Changes |
|------|---------|
| `HelpList.tsx` | Remove cards grid, enhance type switch behavior |
| `LexicalEditor.tsx` | Add toolbar, plugins, image support |
| `LexicalViewer.tsx` | Add image node support |
| `helpStore.ts` | Add image upload state (optional) |
| `helpService.ts` | Add `uploadImage` method |
| `help.types.ts` | Add `HelpImageUploadResponse` type |

### Files to Create

| File | Purpose |
|------|---------|
| `components/help/RichTextToolbar.tsx` | Editor toolbar component |
| `components/help/ToolbarButton.tsx` | Reusable toolbar button |
| `components/help/ImageUploadDialog.tsx` | Image upload modal |
| `components/help/nodes/ImageNode.tsx` | Custom Lexical image node |
| `components/help/plugins/ImagePlugin.tsx` | Image insertion logic |

### Files to Delete

| File | Reason | Action |
|------|--------|--------|
| `components/help/HelpCard.tsx` | Article cards grid removed from HelpList; no longer used | **DELETE** in Phase 1 after removing imports from `HelpList.tsx` |

**Verification Before Deletion:**
1. Search codebase for `HelpCard` imports: `grep -r "HelpCard" lefarma.frontend/src`
2. Confirm only `HelpList.tsx` references it
3. Remove import and usage from `HelpList.tsx`
4. Delete `HelpCard.tsx` file

### Backend Files to Create

| File | Purpose |
|------|---------|
| `Features/Help/Controllers/HelpImagesController.cs` | Image upload/serve endpoints |
| `Features/Help/Services/HelpImageService.cs` | Image storage business logic |
| `Features/Help/DTOs/HelpImageDto.cs` | Image response DTO |

---

*Document generated by SDD Design Phase sub-agent*
*Last updated: 2026-03-25*
