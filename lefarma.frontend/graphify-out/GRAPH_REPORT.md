# Graph Report - .  (2026-06-22)

## Corpus Check
- 239 files · ~169,261 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1597 nodes · 4089 edges · 82 communities (65 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Catalog List Pages|Catalog List Pages]]
- [[_COMMUNITY_Workflow & Comprobante Upload|Workflow & Comprobante Upload]]
- [[_COMMUNITY_App Registry & Routing|App Registry & Routing]]
- [[_COMMUNITY_Demo Feature Showcase|Demo Feature Showcase]]
- [[_COMMUNITY_Root Dependencies|Root Dependencies]]
- [[_COMMUNITY_CodeBlock Component|CodeBlock Component]]
- [[_COMMUNITY_Gantt Component|Gantt Component]]
- [[_COMMUNITY_Real-Time Notification System|Real-Time Notification System]]
- [[_COMMUNITY_Combobox Component|Combobox Component]]
- [[_COMMUNITY_Table Filters & Config Storage|Table Filters & Config Storage]]
- [[_COMMUNITY_Sidebar Navigation & Mobile|Sidebar Navigation & Mobile]]
- [[_COMMUNITY_Calendar Component|Calendar Component]]
- [[_COMMUNITY_Carousel Component|Carousel Component]]
- [[_COMMUNITY_Proveedores (Suppliers) Module|Proveedores (Suppliers) Module]]
- [[_COMMUNITY_Root DevDependencies|Root DevDependencies]]
- [[_COMMUNITY_Toast System|Toast System]]
- [[_COMMUNITY_Purchase Order Creation|Purchase Order Creation]]
- [[_COMMUNITY_Auth & Empresa Selection|Auth & Empresa Selection]]
- [[_COMMUNITY_Accordion & Utils|Accordion & Utils]]
- [[_COMMUNITY_User Sync & SSE Service|User Sync & SSE Service]]
- [[_COMMUNITY_Notification Bell & Header|Notification Bell & Header]]
- [[_COMMUNITY_TSConfig (app)|TSConfig (app)]]
- [[_COMMUNITY_Comprobante & Currency Formatting|Comprobante & Currency Formatting]]
- [[_COMMUNITY_TSConfig (node)|TSConfig (node)]]
- [[_COMMUNITY_Auth Routing (BlockedHandoff)|Auth Routing (Blocked/Handoff)]]
- [[_COMMUNITY_shadcnui Config|shadcn/ui Config]]
- [[_COMMUNITY_RequireAuth Guard|RequireAuth Guard]]
- [[_COMMUNITY_UI Preferences & Presets|UI Preferences & Presets]]
- [[_COMMUNITY_Proveedores List & Authorization|Proveedores List & Authorization]]
- [[_COMMUNITY_Permission Types|Permission Types]]
- [[_COMMUNITY_Dashboard & Currency|Dashboard & Currency]]
- [[_COMMUNITY_Envío Concentrado (Orders)|Envío Concentrado (Orders)]]
- [[_COMMUNITY_Menubar Component|Menubar Component]]
- [[_COMMUNITY_ExcelFile Viewer & Uploader|Excel/File Viewer & Uploader]]
- [[_COMMUNITY_Image Crop Component|Image Crop Component]]
- [[_COMMUNITY_Purchase Order PDF Generation|Purchase Order PDF Generation]]
- [[_COMMUNITY_Auto-Verify & Token Refresh|Auto-Verify & Token Refresh]]
- [[_COMMUNITY_Comprobante Service & Types|Comprobante Service & Types]]
- [[_COMMUNITY_API Client & Token Refresh|API Client & Token Refresh]]
- [[_COMMUNITY_UI Config Components (Presets)|UI Config Components (Presets)]]
- [[_COMMUNITY_Envío Concentrado PDF|Envío Concentrado PDF]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_Column Filter Config|Column Filter Config]]
- [[_COMMUNITY_Workflow Plantillas & Canales|Workflow Plantillas & Canales]]
- [[_COMMUNITY_Orden Flujo PDF|Orden Flujo PDF]]
- [[_COMMUNITY_Concentrado PDF Generator|Concentrado PDF Generator]]
- [[_COMMUNITY_Archivo Service & File Upload|Archivo Service & File Upload]]
- [[_COMMUNITY_Context Menu Component|Context Menu Component]]
- [[_COMMUNITY_Permission Guard|Permission Guard]]
- [[_COMMUNITY_Breadcrumb Component|Breadcrumb Component]]
- [[_COMMUNITY_Drawer Component|Drawer Component]]
- [[_COMMUNITY_Dashboard Types|Dashboard Types]]
- [[_COMMUNITY_usePermission Hook|usePermission Hook]]
- [[_COMMUNITY_Main Layout & Sidebar Provider|Main Layout & Sidebar Provider]]
- [[_COMMUNITY_Loader Component|Loader Component]]
- [[_COMMUNITY_Currency Utilities|Currency Utilities]]
- [[_COMMUNITY_Sidebar Menu Items|Sidebar Menu Items]]
- [[_COMMUNITY_CodeBlock Server|CodeBlock Server]]
- [[_COMMUNITY_HTML Viewer (Help)|HTML Viewer (Help)]]
- [[_COMMUNITY_OpenCode Config|OpenCode Config]]
- [[_COMMUNITY_OpenCode Plugin Package|OpenCode Plugin Package]]
- [[_COMMUNITY_Test Setup Stubs|Test Setup Stubs]]
- [[_COMMUNITY_Package Type Field|Package Type Field]]
- [[_COMMUNITY_Lefarma Logo|Lefarma Logo]]
- [[_COMMUNITY_Noise Texture Asset|Noise Texture Asset]]
- [[_COMMUNITY_React Logo|React Logo]]
- [[_COMMUNITY_Skill Registry Index|Skill Registry Index]]
- [[_COMMUNITY_Dark Mode FOUC Prevention|Dark Mode FOUC Prevention]]
- [[_COMMUNITY_React Root Mount|React Root Mount]]
- [[_COMMUNITY_OpenCode Memory Stub|OpenCode Memory Stub]]
- [[_COMMUNITY_pnpm Workspace Config|pnpm Workspace Config]]
- [[_COMMUNITY_Vite Logo|Vite Logo]]
- [[_COMMUNITY_Vite React TS Template|Vite React TS Template]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 140 edges
2. `Button` - 69 edges
3. `usePageTitle()` - 54 edges
4. `useAuthStore` - 49 edges
5. `Input` - 41 edges
6. `API` - 41 edges
7. `toApiError()` - 38 edges
8. `ApiResponse` - 36 edges
9. `Badge()` - 33 edges
10. `Checkbox` - 33 edges

## Surprising Connections (you probably didn't know these)
- `SSE Real-Time Notification System` --semantically_similar_to--> `UI Preferences Preset System`  [INFERRED] [semantically similar]
  docs/uso-notificaciones-frontend.md → docs/superpowers/specs/2026-03-24-ui-preferences-design.md
- `GanttCreateMarkerTrigger()` --calls--> `formatDate()`  [INFERRED]
  src/components/kibo-ui/gantt/index.tsx → src/components/archivos/FileViewer.tsx
- `Combobox()` --calls--> `cn()`  [EXTRACTED]
  src/components/kibo-ui/calendar/index.tsx → src/lib/utils.ts
- `GanttFeatureRow()` --calls--> `cn()`  [EXTRACTED]
  src/components/kibo-ui/gantt/index.tsx → src/lib/utils.ts
- `BreadcrumbSeparator()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/breadcrumb.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SSE Notification Real-Time Flow** — services_notificationservice, services_sseservice, hooks_usenotifications, store_notificationstore, docs_notif_sse_realtime_system [EXTRACTED 1.00]
- **UI Preset Application Chain** — constants_uipresets, config_presetselector, store_configstore, specs_uiprefs_apply_visual_prefs, specs_uiprefs_preset_system [EXTRACTED 1.00]

## Communities (82 total, 17 thin omitted)

### Community 0 - "Catalog List Pages"
Cohesion: 0.05
Nodes (93): AreaFormValues, AreaRequest, areaSchema, AreasList(), CentroCosto, CentroCostoFormValues, CentroCostoRequest, centroCostoSchema (+85 more)

### Community 1 - "Workflow & Comprobante Upload"
Cohesion: 0.06
Nodes (82): API, Step, TIPOS, AsignacionLocal, MedioPagoItem, Step, EMPTY_LEXICAL_JSON, MODULOS (+74 more)

### Community 2 - "App Registry & Routing"
Cohesion: 0.05
Nodes (62): appRegistry, AppRegistryEntry, DOMAIN_NAMES, Home(), ConfiguracionGeneral(), TabItem, tabs, PerfilConfig() (+54 more)

### Community 3 - "Demo Feature Showcase"
Cohesion: 0.03
Nodes (65): CodeBlockSelect(), CodeBlockSelectContent(), CodeBlockSelectValue(), GanttFeatureList(), GanttFeatureListGroup(), GanttHeader(), GanttMarker, GanttSidebarGroup() (+57 more)

### Community 4 - "Root Dependencies"
Cohesion: 0.02
Nodes (85): dependencies, axios, class-variance-authority, clsx, cmdk, date-fns, @dnd-kit/core, @dnd-kit/modifiers (+77 more)

### Community 5 - "CodeBlock Component"
Cohesion: 0.05
Nodes (53): CodeBlock(), CodeBlockBody(), CodeBlockBodyProps, codeBlockClassName, CodeBlockContent(), CodeBlockContentProps, CodeBlockContext, CodeBlockContextType (+45 more)

### Community 6 - "Gantt Component"
Cohesion: 0.05
Nodes (50): calculateInnerOffset(), createInitialTimelineData(), draggingAtom, GanttAddFeatureHelper(), GanttAddFeatureHelperProps, GanttColumn(), GanttColumnProps, GanttColumnsProps (+42 more)

### Community 7 - "Real-Time Notification System"
Cohesion: 0.08
Nodes (28): Rationale: SSE chosen to avoid polling for notifications, Notification Channels (email/telegram/in-app), SSE Real-Time Notification System, SSE_NOTIFICATIONS_URL, TicketResponse, UseNotificationsOptions, UseNotificationsReturn, NotificationListProps (+20 more)

### Community 8 - "Combobox Component"
Cohesion: 0.07
Nodes (36): Combobox(), ComboboxContent(), ComboboxContentProps, ComboboxContext, ComboboxContextType, ComboboxCreateNew(), ComboboxCreateNewProps, ComboboxData (+28 more)

### Community 9 - "Table Filters & Config Storage"
Cohesion: 0.09
Nodes (25): createDefaultConfig(), getAllConfigs(), getConfig(), resetConfig(), saveConfig(), Window, ActiveFiltersBarProps, BooleanFilterPopoverProps (+17 more)

### Community 10 - "Sidebar Navigation & Mobile"
Cohesion: 0.09
Nodes (30): useIsMobile(), menuItems, SidebarMenuItemConfig, Separator, SheetDescription, Sidebar, SidebarContent, SidebarContext (+22 more)

### Community 11 - "Calendar Component"
Cohesion: 0.07
Nodes (30): CalendarBody(), CalendarBodyProps, CalendarContext, CalendarContextProps, CalendarDate(), CalendarDatePagination(), CalendarDatePaginationProps, CalendarDatePicker() (+22 more)

### Community 12 - "Carousel Component"
Cohesion: 0.06
Nodes (26): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+18 more)

### Community 13 - "Proveedores (Suppliers) Module"
Cohesion: 0.08
Nodes (26): proveedorApi, BulkUploadModal(), BulkUploadModalProps, BulkUploadResult, BulkUploadRowError, BancoLite, ClavesReferenciaModal(), ClavesReferenciaModalProps (+18 more)

### Community 14 - "Root DevDependencies"
Cohesion: 0.06
Nodes (32): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom (+24 more)

### Community 15 - "Toast System"
Cohesion: 0.11
Nodes (24): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+16 more)

### Community 16 - "Purchase Order Creation"
Cohesion: 0.10
Nodes (21): CrearOrdenCompra(), emptyPartida, fmt(), FormValues, NumericInput(), ordenCompraSchema, PartidaFormValues, partidaSchema (+13 more)

### Community 17 - "Auth & Empresa Selection"
Cohesion: 0.18
Nodes (19): authService, TinyMceEditorProps, CambiarUbicacionModalProps, AuthState, Empresa, LoginCredentials, LoginResponse, LoginStepOneRequest (+11 more)

### Community 18 - "Accordion & Utils"
Cohesion: 0.08
Nodes (18): AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, alertVariants, HoverCardContent (+10 more)

### Community 19 - "User Sync & SSE Service"
Cohesion: 0.16
Nodes (11): useUserSync(), UseUserSyncOptions, UseUserSyncReturn, EventCallback, SseService, SseConnectedEvent, SseConnectionState, SseEvent (+3 more)

### Community 20 - "Notification Bell & Header"
Cohesion: 0.15
Nodes (17): useNotificationList(), useNotifications(), Header(), NotificationBell(), NotificationBellProps, useNotificationStore, PageState, usePageStore (+9 more)

### Community 21 - "TSConfig (app)"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleDetection (+14 more)

### Community 22 - "Comprobante & Currency Formatting"
Cohesion: 0.10
Nodes (19): formatCurrency(), SubirComprobanteModal(), formatCurrency(), SubirComprobantePagoModal(), AccionDisponibleResponse, AccionHandlerResponse, AutorizacionesOC(), CampoFormItem (+11 more)

### Community 23 - "TSConfig (node)"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, composite, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 24 - "Auth Routing (Blocked/Handoff)"
Cohesion: 0.16
Nodes (13): useAuthStore, BlockedPage(), HandoffLogin(), Login(), SelectEmpresaSucursal(), CambiarUbicacionModal(), RecipientSelector(), NotFound() (+5 more)

### Community 25 - "shadcn/ui Config"
Cohesion: 0.10
Nodes (19): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+11 more)

### Community 26 - "RequireAuth Guard"
Cohesion: 0.14
Nodes (7): RequireAuth(), RequireAuthProps, LocationStub, mockAuthState, BaseAppRoutes(), Profile(), ShellLayout()

### Community 27 - "UI Preferences & Presets"
Cohesion: 0.17
Nodes (15): UI_PRESETS, DEFAULT_GLOBAL_CONFIG, DEFAULT_SISTEMA_INFO, DEFAULT_UI_CONFIG, ComponentPreferences, ConfigState, ConfiguracionGlobal, NotificacionPreference (+7 more)

### Community 28 - "Proveedores List & Authorization"
Cohesion: 0.11
Nodes (14): Banco, CampoDiff, DiffModalState, ESTATUS, FormaPago, Proveedor, ProveedorDetalle, ProveedorFormaPagoCuenta (+6 more)

### Community 29 - "Permission Types"
Cohesion: 0.18
Nodes (16): AsignarRolesAPermisoRequest, AsignarUsuariosAPermisoRequest, CreatePermisoRequest, Permiso, PermisoConRolesYUsuarios, UpdatePermisoRequest, AsignarUsuariosRequest, CreateRolRequest (+8 more)

### Community 30 - "Dashboard & Currency"
Cohesion: 0.12
Nodes (7): useCurrency(), COLORS, Dashboard(), DistribucionItem, ESTADO_COLORS, EmptyState(), EmptyStateProps

### Community 31 - "Envío Concentrado (Orders)"
Cohesion: 0.17
Nodes (13): AGRUPACIONES, EnvioConcentrado(), EnvioConcentradoItemResult, EnvioConcentradoResponse, fmtMoney(), Table, TableBody, TableCaption (+5 more)

### Community 32 - "Menubar Component"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 33 - "Excel/File Viewer & Uploader"
Cohesion: 0.19
Nodes (12): ExcelTable(), ExcelTableProps, FileUploader(), EXT_COLORS, extColor(), FileViewer(), FileViewerProps, formatDate() (+4 more)

### Community 34 - "Image Crop Component"
Cohesion: 0.15
Nodes (12): CropperProps, ImageCrop(), ImageCropApply(), ImageCropApplyProps, ImageCropContent(), ImageCropContentProps, ImageCropContext, ImageCropContextType (+4 more)

### Community 35 - "Purchase Order PDF Generation"
Cohesion: 0.15
Nodes (14): Proveedor, Proveedor, Props, Props, fmtDate(), HistorialWorkflowItem, OrdenCompraPDF(), PasoFlowItem (+6 more)

### Community 36 - "Auto-Verify & Token Refresh"
Cohesion: 0.19
Nodes (10): AutoVerify(), VerificationStep, useTokenRefresh(), navigateTo(), setNavigate(), AppRoutes(), App(), NavigationRegistrar() (+2 more)

### Community 37 - "Comprobante Service & Types"
Cohesion: 0.20
Nodes (13): Props, Props, comprobanteService, SubirComprobanteParams, AsignarPartidasRequest, CfdiConceptoPreviewDto, CfdiPreviewResponse, ComprobanteAsignacionResponse (+5 more)

### Community 38 - "API Client & Token Refresh"
Cohesion: 0.14
Nodes (10): apiClient, refreshSubscribers, MedidaFormValues, MedidaRequest, MedidasList(), medidasSchema, UnidadMedidaFormValues, UnidadMedidaRequest (+2 more)

### Community 39 - "UI Config Components (Presets)"
Cohesion: 0.25
Nodes (10): AdvancedConfigUI(), PRESET_OPTIONS, PresetSelector(), UIConfig(), applyVisualPreferences helper (sets CSS vars on documentElement), CSS Variable Theming for Density/Font-Scale, Decision: persist UI prefs to localStorage (no backend sync), UI Preferences Preset System (+2 more)

### Community 40 - "Envío Concentrado PDF"
Cohesion: 0.21
Nodes (13): AGRUPACION_LABELS, AgrupacionKey, agruparRows(), buildRows(), COL_HEADERS, COL_WIDTHS, EnvioConcentradoPDF(), fmtDate() (+5 more)

### Community 41 - "Package Scripts"
Cohesion: 0.14
Nodes (13): name, private, scripts, build, build:qa, dev, format, lint (+5 more)

### Community 42 - "Column Filter Config"
Cohesion: 0.19
Nodes (10): Column, ColumnFilterConfig, FilterConfig(), FilterConfigProps, DialogContent, DialogContentProps, DialogDescription, DialogFooter() (+2 more)

### Community 43 - "Workflow Plantillas & Canales"
Cohesion: 0.22
Nodes (11): WorkflowNotificacionCanal, Input, CANAL_DEFAULTS, PlantillaBase, PlantillasEditModal(), PlantillasEditModalProps, EMPTY_REC, REC_VARS (+3 more)

### Community 44 - "Orden Flujo PDF"
Cohesion: 0.19
Nodes (10): ESTADO_COLOR, ESTADO_INFO, ESTADO_VISUAL_LABEL, EstadoVisual, FlujoOrdenPDF(), fmtDate(), fmtMoney(), HistorialPDFItem (+2 more)

### Community 45 - "Concentrado PDF Generator"
Cohesion: 0.27
Nodes (11): AGRUPACION_LABELS, AgrupacionKey, agruparRows(), buildRows(), fmtDate(), fmtMoney(), generarConcentradoPDF(), getGroupKey() (+3 more)

### Community 46 - "Archivo Service & File Upload"
Cohesion: 0.36
Nodes (8): DEFAULT_TIPOS_PERMITIDOS, FileUploaderProps, archivoService, Archivo, ArchivoListItem, ListarArchivosParams, ReemplazarArchivoParams, SubirArchivoParams

### Community 47 - "Context Menu Component"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 48 - "Permission Guard"
Cohesion: 0.36
Nodes (7): PermissionGuard(), PermissionGuardProps, hasPermission(), checkPermission(), extractPermissionsFromJwt(), getUserPermissions(), normalizeCodes()

### Community 49 - "Breadcrumb Component"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 50 - "Drawer Component"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 51 - "Dashboard Types"
Cohesion: 0.29
Nodes (6): ActividadRecienteItem, DashboardStatsResponse, DistribucionItem, GraficaMensualItem, PagoUrgenteItem, PipelineCardsStats

### Community 52 - "usePermission Hook"
Cohesion: 0.47
Nodes (3): usePermission(), PermissionGuard(), PermissionGuardProps

### Community 53 - "Main Layout & Sidebar Provider"
Cohesion: 0.33
Nodes (5): AppSidebar(), MainLayout(), SidebarInset, SidebarProvider, useSidebar()

### Community 54 - "Loader Component"
Cohesion: 0.40
Nodes (4): Loader(), LoaderProps, SIZE_SCALE, VARIANT_CLASSES

### Community 56 - "Sidebar Menu Items"
Cohesion: 0.50
Nodes (4): CollapsibleMenuItem, MenuItem, MenuItemBase, PermissionCheckOptions

## Knowledge Gaps
- **697 isolated node(s):** `$schema`, `plugin`, `@opencode-ai/plugin`, `type`, `$schema` (+692 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `CodeBlock Component` to `Catalog List Pages`, `Workflow & Comprobante Upload`, `App Registry & Routing`, `Demo Feature Showcase`, `Gantt Component`, `Combobox Component`, `Table Filters & Config Storage`, `Sidebar Navigation & Mobile`, `Calendar Component`, `Carousel Component`, `Toast System`, `Purchase Order Creation`, `Accordion & Utils`, `Notification Bell & Header`, `Dashboard & Currency`, `Envío Concentrado (Orders)`, `Menubar Component`, `Excel/File Viewer & Uploader`, `Image Crop Component`, `UI Config Components (Presets)`, `Column Filter Config`, `Workflow Plantillas & Canales`, `Context Menu Component`, `Breadcrumb Component`, `Drawer Component`, `Loader Component`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `Button` connect `Catalog List Pages` to `Workflow & Comprobante Upload`, `App Registry & Routing`, `Demo Feature Showcase`, `CodeBlock Component`, `Combobox Component`, `Table Filters & Config Storage`, `Sidebar Navigation & Mobile`, `Calendar Component`, `Carousel Component`, `Proveedores (Suppliers) Module`, `Purchase Order Creation`, `Auth & Empresa Selection`, `Notification Bell & Header`, `Comprobante & Currency Formatting`, `Auth Routing (Blocked/Handoff)`, `Proveedores List & Authorization`, `Dashboard & Currency`, `Envío Concentrado (Orders)`, `Image Crop Component`, `API Client & Token Refresh`, `UI Config Components (Presets)`, `Column Filter Config`, `Workflow Plantillas & Canales`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `useAuthStore` connect `Auth Routing (Blocked/Handoff)` to `Catalog List Pages`, `App Registry & Routing`, `Auto-Verify & Token Refresh`, `API Client & Token Refresh`, `Real-Time Notification System`, `Combobox Component`, `Sidebar Navigation & Mobile`, `Purchase Order Creation`, `Auth & Empresa Selection`, `User Sync & SSE Service`, `Notification Bell & Header`, `usePermission Hook`, `Main Layout & Sidebar Provider`, `RequireAuth Guard`, `UI Preferences & Presets`, `Envío Concentrado (Orders)`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `$schema`, `plugin`, `@opencode-ai/plugin` to the rest of the system?**
  _699 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Catalog List Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05470967741935484 - nodes in this community are weakly interconnected._
- **Should `Workflow & Comprobante Upload` be split into smaller, more focused modules?**
  _Cohesion score 0.060182488837119005 - nodes in this community are weakly interconnected._
- **Should `App Registry & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.050284031138228484 - nodes in this community are weakly interconnected._