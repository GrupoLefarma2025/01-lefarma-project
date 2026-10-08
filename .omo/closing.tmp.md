- [ ] F1. Plan compliance audit
  What to do / Must NOT do: Verificar que los 16 todos existen, que cada uno cierra al menos una fila GAP, que cada IS row tiene un todo que la entrega, y que las guardarrailes de Must NOT have se respetaron. Comprobar que `git status --short` no muestra `lefarma.backend/src/Lefarma.API/appsettings.Development.json` como MODIFICADO por este trabajo (debe seguir con el cambio previo `LefarmaDev`), ni `odd/tasks/costos-ruta-formulario.md`, ni `pruebas de gastos/` trackeados. Must NOT do: modificar codigo para hacer pasar la auditoria.
  Acceptance criteria (agent-executable): un script cuenta 16 filas `- [ ] N.` y 4 filas `- [ ] F<N>.`; cada GAP-1..GAP-12 aparece en al menos un `Closes:`; `git status --short` no lista archivos fuera del conjunto permitido; ningun todo declara `Commit: Y`.
  QA scenarios: happy — el script imprime OK para las 6 comprobaciones. fallo — si un GAP no esta cerrado por ningun todo, F1 falla y nombra el GAP huerfano.
  Evidence `.omo/evidence/final-f1-viaticos-wizard-ruta-pi-busqueda.md`

- [ ] F2. Code quality review
  What to do / Must NOT do: Revisar los archivos tocados contra los patrones del repo: envelope `success/data/message`, `ErrorOr`, `IMemoryCache` con timeout, `TienePermiso` en vez de roles, pruebas inyeccionadas en vez de `new`, componentes shadcn en vez de HTML crudo. Verificar que no hay `any` implicito, ni dependencias nuevas no permitidas (`package.json` solo puede haber cambiado si T2 justifico algo; en cuyo caso debe justificarse). Must NOT do: reescribir codigo; reportar solo.
  Acceptance criteria (agent-executable): `npm run lint` (eslint, `--max-warnings 0`) exit 0; `dotnet build` exit 0 sin warnings nuevos; la revision confirma o refute cada patron con `ruta:linea`.
  QA scenarios: happy — lint y build limpios y cada patron confirmado con cita. fallo — un `console.log`, un `any` o un endpoint sin `TienePermiso` hace fallar F2.
  Evidence `.omo/evidence/final-f2-viaticos-wizard-ruta-pi-busqueda.md`

- [ ] F3. Real manual QA con Playwright
  What to do / Must NOT do: Levantar el stack (`npm run dev -- --port 5180 --strictPort` en `lefarma.frontend`, backend en 5174) siguiendo el patron de `lefarma.frontend/tests/login.spec.ts`. Recorrer con un superadmin y con un solicitante: (1) el especialista completa el wizard, (2) elige punto por buscador global, (3) elige punto por cascada, (4) agrega 3 puntos y ve la polylinea, (5) calcula, (6) pega el JSON de pi y ve las tablas con link y captura, (7) envia, (8) el admin autoriza, (9) el admin ve las rechazadas con capturas, (10) el admin cambia vuelo y agrega costo con motivo, (11) se imprime el concentrado. Capturar screenshot en cada paso. Must NOT do: declarar exito sin haber corrido el flujo completo; dejar el servidor vivo (matarlo en `finally`).
  Acceptance criteria (agent-executable): un spec de Playwright cubre los 11 pasos y pasa en una corrida; los 11 screenshots existen en `.omo/evidence/final-f3-*.png`; el proceso del servidor se termina al final (assertion sobre el puerto libre).
  QA scenarios: happy — el recorrido completo deja una solicitud autorizada y el concentrado impreso con la fila. fallo — si un paso falla, F3 reporta exactamente en que paso y con que mensaje, sin maquillar el resultado.
  Evidence `.omo/evidence/final-f3-viaticos-wizard-ruta-pi-busqueda.md`

- [ ] F4. Ideal-state fidelity
  What to do / Must NOT do: Contrastar el comportamiento entregado contra las 12 filas IS una por una, con evidencia. Prestar atencion especial a IS-2 (ambos buscadores usables), IS-7 (las rechazadas visibles con capturas), IS-8 (ajustes con rastro) e IS-11 (ningun estimado vestida de real). Una fila IS sin QA que la demuestre se convierte en una nueva `- [ ] N.`, nunca en una nota. Must NOT do: dar por buena una IS por analogia; exigir el 100% de cobertura de transportistas (es una limitacion declarada).
  Acceptance criteria (agent-executable): una tabla de 12 filas IS con el todo que la entrega, el escenario QA que la prueba y la ruta de evidencia; cero filas IS sin evidencia.
  QA scenarios: happy — las 12 filas tienen evidencia. fallo — IS-7 sin evidencia (p.ej. las rechazadas no se ven) genera un todo nuevo `- [ ] N.` y F4 no aprueba.
  Evidence `.omo/evidence/final-f4-viaticos-wizard-ruta-pi-busqueda.md`

