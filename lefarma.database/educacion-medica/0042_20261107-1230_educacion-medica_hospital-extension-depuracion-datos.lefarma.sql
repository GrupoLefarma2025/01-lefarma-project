-- =============================================================================
-- 0042 — Hospitales: depuración de datos en hospital_extension
--
-- QUÉ HACE
--   1. Asigna IMSS Bienestar (id_tipo_gerencia = 4) a 385 y sus hijos.
--   2. Remapea su región con el catálogo de regiones de IMSS Bienestar.
--   3. Clasifica mostrar_educacion_medica / es_sede_taller / motivo_clasificacion:
--        - Unidades de atención -> mostrar = 1.
--        - Sub-almacenes/farmacias -> mostrar = 1 (no se excluyen).
--        - Personas, proveedores, transportistas, almacenes/CEDIS, pruebas,
--          duplicados claros -> mostrar = 0 y es_sede_taller = 0.
--   4. Marca requiere_revision para duplicados dudosos, CDMX sin región y
--      jerarquías incompletas.
--
-- ALCANCE
--   - Solo modifica educacion_medica.hospital_extension.
--   - No toca Asokam.dbo.genContactosCat.
--   - No elimina registros.
--
-- EJECUCIÓN
--   - Requiere 0041 aplicado.
--   - Ejecutar una vez; reejecutar solo si se desea recalcular.
--   - Las filas con clasificacion_manual = 1 no se sobrescriben.
-- =============================================================================

SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    -- -------------------------------------------------------------------------
    -- 0. Clasificación base en tabla temporal
    -- -------------------------------------------------------------------------
    IF OBJECT_ID('tempdb..#clasif_contactos') IS NOT NULL
        DROP TABLE #clasif_contactos;

    CREATE TABLE #clasif_contactos
    (
        id_hospital INT NOT NULL PRIMARY KEY,
        codigoContactoPrincipal INT NULL,
        nombreContacto VARCHAR(100) NULL,
        tipo VARCHAR(20) NULL,
        padre_nombre VARCHAR(100) NULL,
        padre_tipo VARCHAR(20) NULL,
        es_logistico BIT NOT NULL,
        es_subalmacen_farmacia BIT NOT NULL
    );

    INSERT INTO #clasif_contactos
    (
        id_hospital,
        codigoContactoPrincipal,
        nombreContacto,
        tipo,
        padre_nombre,
        padre_tipo,
        es_logistico,
        es_subalmacen_farmacia
    )
    SELECT
        he.id_hospital,
        g.codigoContactoPrincipal,
        g.nombreContacto,
        g.tipo,
        p.nombreContacto AS padre_nombre,
        p.tipo AS padre_tipo,
        CASE
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ENTREGA%'
                THEN 1
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE 'ASOKAM%'
                THEN 1
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB-ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUBDELEGACIONAL%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FARMACIA%'
                THEN 0
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%CEDIS%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%BIRMEX%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%DISTRIBUIDORA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COMERCIALIZADORA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%INSUMOS%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PHARMA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRANSPORT%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%TRASPORT%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%OFICINA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ADMINISTRATIV%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%PRUEBA%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FALSE%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%COPIA%'
                THEN 1
            WHEN p.tipo IN ('Privado', 'Distribuidor')
                THEN 1
            WHEN UPPER(ISNULL(p.nombreContacto, '')) LIKE '%DISTRIBUIDORA%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERCIALIZADORA%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%INSUMOS%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%PHARMA%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%TRANSPORT%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%TRASPORT%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%PROVEEDOR%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERCIAL%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%CORPORATIVO%'
              OR UPPER(ISNULL(p.nombreContacto, '')) LIKE '%COMERLAT%'
                THEN 1
            ELSE 0
        END AS es_logistico,
        CASE
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%ENTREGA%'
                THEN 0
            WHEN UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB-ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUB ALMAC%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%SUBDELEGACIONAL%'
              OR UPPER(ISNULL(g.nombreContacto, '')) LIKE '%FARMACIA%'
                THEN 1
            ELSE 0
        END AS es_subalmacen_farmacia
    FROM educacion_medica.hospital_extension he
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    LEFT JOIN Asokam.dbo.genContactosCat p
        ON p.codigoContacto = g.codigoContactoPrincipal;

    -- -------------------------------------------------------------------------
    -- 1. IMSS Bienestar: gerencia y región
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.id_tipo_gerencia = 4,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 385
       OR c.id_hospital = 385;

    PRINT CONCAT('IMSS Bienestar - gerencia asignada: ', @@ROWCOUNT, ' fila(s).');

    UPDATE he
    SET he.id_region = ze.id_region,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    JOIN Asokam.dbo.genContactosCat g
        ON g.codigoContacto = he.id_hospital
    JOIN educacion_medica.regiones_estados ze
        ON ze.codigo_estado = TRY_CAST(g.codigoEstado AS INT)
       AND ze.id_tipo_gerencia = 4
    WHERE (g.codigoContacto = 385 OR g.codigoContactoPrincipal = 385)
      AND (he.id_region IS NULL OR he.id_region <> ze.id_region);

    PRINT CONCAT('IMSS Bienestar - región remapeada: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 2. Contactos con codigoContactoPrincipal = 0
    --    Regla general: no son unidades de atención.
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Sin unidad de atención: persona/proveedor/interno',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 0
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('Principal=0 - no hospitalarios: ', @@ROWCOUNT, ' fila(s).');

    -- Excepciones: hospitales independientes / raíces de hospital.
    -- Se revisan aparte por posibles duplicados contra sus hijos.
    DECLARE @hospitales_independientes TABLE (id_hospital INT PRIMARY KEY);

    INSERT INTO @hospitales_independientes (id_hospital)
    VALUES
        (346), (349), (351), (352), (353), (354), (358), (359), (360),
        (365), (366), (367), (368),
        (13284), (13285), (13286), (13328), (13333);

    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.es_sede_taller = 1,
        he.motivo_clasificacion = N'Unidad de atención (revisar duplicado/institución)',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN @hospitales_independientes hi
        ON hi.id_hospital = he.id_hospital
    WHERE he.clasificacion_manual = 0;

    PRINT CONCAT('Principal=0 - hospitales independientes: ', @@ROWCOUNT, ' fila(s).');

    -- Casos especiales con nombre hospitalario que no son unidad de atención.
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Proveedor: no es unidad de atención',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 357
      AND he.clasificacion_manual = 0;

    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Revisión manual: nombre incompleto',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 13376
      AND he.clasificacion_manual = 0;

    -- -------------------------------------------------------------------------
    -- 3. Hijos de 385: IMSS Bienestar
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Logístico: almacén/CEDIS/BIRMEX/distribuidora',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 385
      AND c.es_logistico = 1
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('385 - logísticos excluidos: ', @@ROWCOUNT, ' fila(s).');

    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.es_sede_taller = 1,
        he.motivo_clasificacion = N'Unidad de atención IMSS Bienestar',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 385
      AND c.es_logistico = 0
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('385 - unidades de atención: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 4. Hijos de 364: IMSS
    --    Se conservan sub-almacenes/farmacias como parte del catálogo.
    --    Los almacenes delegacionales/BIRMEX sí se excluyen (no son atención).
    --    No se modifica es_sede_taller de sub-almacenes/farmacias: la regla
    --    actual decide cuál es sede.
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica =
            CASE
                WHEN c.es_logistico = 1 AND c.es_subalmacen_farmacia = 0 THEN 0
                ELSE 1
            END,
        he.es_sede_taller =
            CASE
                WHEN c.es_logistico = 1 AND c.es_subalmacen_farmacia = 0 THEN 0
                ELSE he.es_sede_taller
            END,
        he.motivo_clasificacion =
            CASE
                WHEN c.es_subalmacen_farmacia = 1
                    THEN N'Sede logística (sub-almacén/farmacia)'
                WHEN c.es_logistico = 1
                    THEN N'Logístico: almacén delegacional/BIRMEX'
                ELSE N'Unidad de atención IMSS'
            END,
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 364
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('364 - unidades/sedes conservadas: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 5. Hijos de 370: ISSSTE bajo Descentralizado
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.motivo_clasificacion = N'Unidad de atención ISSSTE (Descentralizado)',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal = 370
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('370 - unidades ISSSTE: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 6. Otros padres: proveedores/entregas fuera; hospitales dentro
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Logístico/proveedor: entrega/transporte/distribuidor',
        he.requiere_revision = 0,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal NOT IN (0, 364, 370, 385)
      AND c.es_logistico = 1
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('Otros padres - logísticos/proveedores excluidos: ', @@ROWCOUNT, ' fila(s).');

    UPDATE he
    SET he.mostrar_educacion_medica = 1,
        he.motivo_clasificacion = N'Unidad de atención (revisar jerarquía)',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    JOIN #clasif_contactos c
        ON c.id_hospital = he.id_hospital
    WHERE c.codigoContactoPrincipal NOT IN (0, 364, 370, 385)
      AND c.es_logistico = 0
      AND he.clasificacion_manual = 0;

    PRINT CONCAT('Otros padres - unidades conservadas: ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 7. Duplicados claros
    --    No se elimina nada; se oculta el registro no canónico.
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Duplicado: se conserva 13352',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital IN (353, 693)
      AND he.clasificacion_manual = 0;

    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Duplicado: se conserva 694',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 354
      AND he.clasificacion_manual = 0;

    UPDATE he
    SET he.mostrar_educacion_medica = 0,
        he.es_sede_taller = 0,
        he.motivo_clasificacion = N'Duplicado: se conserva 700',
        he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.id_hospital = 360
      AND he.clasificacion_manual = 0;

    PRINT 'Duplicados claros ocultados: 353, 693, 354, 360.';

    -- -------------------------------------------------------------------------
    -- 8. Revisiones manuales
    -- -------------------------------------------------------------------------
    UPDATE he
    SET he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.clasificacion_manual = 0
      AND he.id_hospital IN (
          346,                          -- Centro Regional de Alta Especialidad de Chiapas
          349, 351, 352, 358,           -- Hospitales independientes
          365, 366, 367, 368,           -- Institutos nacionales
          359, 699, 13285,              -- IXTAPALUCA (3 registros)
          13284, 13286,                 -- Regionales nuevos
          13328, 13333,                 -- Hospitales independientes
          13340,                        -- Posible duplicado de 694
          772, 773,                     -- UMAE Trauma y Ortopedia (posible duplicado)
          774, 13338,                   -- Sub-almacén duplicado
          798, 799, 13325, 13352        -- Hijos de 383 / canónicos
      );

    PRINT CONCAT('Registros marcados para revisión manual: ', @@ROWCOUNT, ' fila(s).');

    -- CDMX: unidades visibles sin región (no hay mapeo estado->región para 493).
    -- Incluye hospitales IMSS Bienestar y sub-almacenes/farmacias IMSS.
    UPDATE he
    SET he.requiere_revision = 1,
        he.fecha_modificacion = SYSUTCDATETIME()
    FROM educacion_medica.hospital_extension he
    WHERE he.clasificacion_manual = 0
      AND he.mostrar_educacion_medica = 1
      AND he.id_region IS NULL;

    PRINT CONCAT('Unidades visibles sin región (revisión): ', @@ROWCOUNT, ' fila(s).');

    -- -------------------------------------------------------------------------
    -- 9. Resumen
    -- -------------------------------------------------------------------------
    SELECT
        mostrar_educacion_medica,
        es_sede_taller,
        requiere_revision,
        COUNT(*) AS total
    FROM educacion_medica.hospital_extension
    GROUP BY mostrar_educacion_medica, es_sede_taller, requiere_revision
    ORDER BY mostrar_educacion_medica DESC, es_sede_taller DESC, requiere_revision DESC;

    SELECT
        id_tipo_gerencia,
        COUNT(*) AS total,
        SUM(CASE WHEN mostrar_educacion_medica = 1 THEN 1 ELSE 0 END) AS visibles
    FROM educacion_medica.hospital_extension
    GROUP BY id_tipo_gerencia
    ORDER BY id_tipo_gerencia;

    COMMIT TRANSACTION;
    PRINT '0042 completado: depuración aplicada a hospital_extension.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    PRINT 'ERROR en 0042: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

