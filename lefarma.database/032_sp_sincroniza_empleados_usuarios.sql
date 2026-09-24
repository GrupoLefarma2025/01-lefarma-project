/* ============================================================================
   032_sp_sincroniza_empleados_usuarios.sql
   Grupo Lefarma — Sincronización diaria de usuarios de la app

   OBJETIVO
   --------
   Mantener al día app.usuarios (Asokam, 192.168.4.2) y config.usuario_detalle
   (Lefarma, mismo servidor) a partir de dos fuentes de verdad:

     - RH:  Asistencias.dbo.vwEmpleados  (192.168.1.5)  — empleados vivos
     - AD:  Asokam.dbo.vwDirectorioActivo (local)       — cuentas de directorio activo

   QUÉ HACE
   --------
   1. CORRIGE dominio: usuarios cuyo (SamAccountName, Dominio) no existe en el AD
      pero que SÍ existen en el AD bajo el dominio derivado de su correo
      (p.ej. los dados de alta con Dominio='Construmedika' que en el AD son
      'Grupolefarma' o 'Lefarma' — hoy no pueden autenticar).
    2. CORRIGE correo: completa o alinea app.usuarios.Correo con el correo de RH.
    2b. CAMBIO DE TITULAR: si la MISMA cuenta (mismo correo) pasa a otra
        persona con OTRO número de nómina — típico: dan de baja a alguien y su
        correo se le asigna a un nuevo ingreso — renueva nombre, nómina, puesto
        y empresa desde RH y lo reporta como CAMBIO_TITULAR.
    2c. LIBERA el correo de filas en baja cuando una cuenta ACTIVA ya lo
        reclama (su sam+dominio derivado del correo coincide con ella):
        Correo = NULL, conservando nombre, nómina y sam como histórico. Si dos
        filas ACTIVAS comparten correo, no se libera nada: solo se reporta
        CORREO_DUPLICADO para que una persona decida. Las cuentas en
        @excepciones_baja jamás se tocan.
   3. INSERTA altas: empleados de RH con correo y nómina, cuya cuenta
      (sam derivado del correo + dominio derivado del sufijo) existe en el AD
      y todavía no está en app.usuarios. Les crea su config.usuario_detalle.
   4. DESACTIVA bajas: usuarios de AD (no anónimos, no robots) que ya NO existen
      en vwEmpleados (ni por correo ni por nómina) → EsActivo = 0
      y config.usuario_detalle.activo = 0.
   5. REACTIVA: usuarios inactivos que volvieron a aparecer en RH.
    6. REPORTA (resultsets): altas, correcciones, bajas, nombres por revisar,
       empleados pendientes sin cuenta en AD y duplicados.
    7. NOTIFICA por correo (app.sp_enviar_correo) a @correo_notifica solo
       cuando hay filas: (a) acciones del día (correcciones dominio/correo,
       altas, detalle, bajas/reactivaciones), (b) nombres corregidos,
       (c) nombres por revisar con script sugerido, (d) pendientes sin AD.

   NO HACE (a propósito)
   ---------------------
   - No borra NUNCA filas: las bajas son SOFT (EsActivo = 0, reversible).
   - Solo normaliza NombreCompleto cuando trae el prefijo de cuenta del AD
     (ej. '1a1 Luis...') o difiere de RH solo en espacios. Las etiquetas
     manuales tipo "Vacante Consultor CVS", "Marco Castillo" o erratas NO se
     tocan: esos diffs se listan en REVISAR_NOMBRE para que RH decida.Q

   DÓNDE EJECUTAR
   --------------
   Servidor 192.168.4.2, base Asokam. Requiere permisos de escritura en
   Asokam.app.usuarios y Lefarma.config.usuario_detalle, y permiso de lectura
   por el linked server [ESFR-DOCTS] (192.168.1.5).

   PROGRAMAR
   ---------
   Job diario (p.ej. 06:00):
     EXEC Asokam.app.sp_sincroniza_empleados_usuarios;
   ============================================================================ */

/* ---------------------------------------------------------------------------
   0) Función de capitalización (Title Case) — los nombres en RH vienen en
      MAYÚSCULAS y la app los usa en formato título.
   --------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[app].[fn_Capitaliza]') AND type IN ('FN','FS'))
BEGIN
    EXEC(N'CREATE FUNCTION [app].[fn_Capitaliza](@texto NVARCHAR(512))
    RETURNS NVARCHAR(512)
    AS
    BEGIN
        DECLARE @res NVARCHAR(512) = LOWER(LTRIM(RTRIM(ISNULL(@texto, ''''))));
        IF @res = '''' RETURN @res;
        DECLARE @i INT = 1, @n INT = LEN(@res), @prev BIT = 1;
        DECLARE @c NCHAR(1);
        WHILE @i <= @n
        BEGIN
            SET @c = SUBSTRING(@res, @i, 1);
            IF @prev = 1
                SET @res = STUFF(@res, @i, 1, UPPER(@c));
            SET @prev = CASE WHEN @c LIKE ''[a-záéíóúñü]'' THEN 0 ELSE 1 END;
            SET @i += 1;
        END
        RETURN @res;
    END');
END
GO

/* ---------------------------------------------------------------------------
   1) Procedimiento principal
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE [app].[sp_sincroniza_empleados_usuarios]
    @correo_notifica VARCHAR(256) = '6@grupolefarma.com.mx'  -- NULL o '' = no enviar correos
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    /* --- Parámetros de negocio (ajustables) --------------------------------
       Sucursal por defecto para el alta de config.usuario_detalle, según la
       convención observada en los detalles existentes.                        */
    DECLARE @suc_default_artricenter   INT = 2;   -- Zaragoza (empresa 1)
    DECLARE @suc_default_asokam        INT = 6;   -- Antonio Maura (empresa 7)
    DECLARE @suc_default_lefarma       INT = 23;  -- Mancera (empresa 8)
    DECLARE @suc_default_construmedika INT = 21;  -- Unica (empresa 11)
    DECLARE @suc_default_grupolefarma  INT = 25;  -- Oficinas centrales (empresa 12)

    /* --- Excepciones de baja ------------------------------------------------
       Cuentas que NUNCA se desactivan, aunque no aparezcan en vwEmpleados. */
    DECLARE @excepciones_baja TABLE (
        SamAccountName VARCHAR(256) COLLATE DATABASE_DEFAULT,
        Dominio        VARCHAR(256) COLLATE DATABASE_DEFAULT,
        Motivo         VARCHAR(200) COLLATE DATABASE_DEFAULT
    );
    INSERT INTO @excepciones_baja (SamAccountName, Dominio, Motivo) VALUES
        ('a', 'Grupolefarma', 'Cuenta de Hector Velez - pendiente de confirmacion de RH');

    /* --- Staging: lectura de RH por linked server --------------------------
       Se usa OPENQUERY (lectura distribuida sin MSDTC). EXEC(...) AT exigiría
       transacción distribuida y falla con Msg 7391 si el DTC del servidor no
       tiene Network DTC Access habilitado.                                   */
    IF OBJECT_ID('tempdb..#rh') IS NOT NULL DROP TABLE #rh;
    CREATE TABLE #rh (
        nomina        BIGINT        NOT NULL,
        nombre        NVARCHAR(300) COLLATE DATABASE_DEFAULT,
        apellidos     NVARCHAR(300) COLLATE DATABASE_DEFAULT,
        correo        VARCHAR(512)  COLLATE DATABASE_DEFAULT,
        empresa       VARCHAR(100)  COLLATE DATABASE_DEFAULT,
        departamento  VARCHAR(200)  COLLATE DATABASE_DEFAULT,
        puesto        VARCHAR(300)  COLLATE DATABASE_DEFAULT,
        /* Columnas derivadas — se declaran desde el inicio porque
           ALTER TABLE ADD + referencia en el mismo procedimiento
           produce Msg 207 (Invalid column name). */
        sam           VARCHAR(256)  COLLATE DATABASE_DEFAULT NULL,
        dominio       VARCHAR(256)  COLLATE DATABASE_DEFAULT NULL,
        emp_id        INT           NULL,
        en_ad         BIT           NOT NULL DEFAULT(0)
    );

    INSERT INTO #rh (nomina, nombre, apellidos, correo, empresa, departamento, puesto)
    SELECT nomina, nombre, apellidos, correo, empresa, departamento, puesto
    FROM OPENQUERY([ESFR-DOCTS], 'SELECT nomina, nombre, apellidos, correo, empresa, departamento, puesto
                                  FROM Asistencias.dbo.vwEmpleados
                                  WHERE correo IS NOT NULL AND LTRIM(RTRIM(correo)) <> ''''
                                    AND nomina IS NOT NULL');

    /* Identidad derivada: sam = parte local del correo;
       dominio = según el sufijo del correo; emp_id = empresa del catálogo.    */
    UPDATE r SET
        r.sam     = LEFT(LTRIM(RTRIM(r.correo)), CHARINDEX('@', LTRIM(RTRIM(r.correo))) - 1),
        r.dominio = CASE
                      WHEN r.correo LIKE '%@grupolefarma.com.mx' THEN 'Grupolefarma'
                      WHEN r.correo LIKE '%@asokam.mx'          THEN 'Asokam'
                      WHEN r.correo LIKE '%@lefarma.com.mx'     THEN 'Lefarma'
                      WHEN r.correo LIKE '%@artricenter.com.mx' THEN 'Artricenter'
                      WHEN r.correo LIKE '%@construmedika.com'  THEN 'Construmedika'
                    END,
        r.emp_id  = CASE UPPER(LTRIM(RTRIM(r.empresa)))
                      WHEN 'ARTRICENTER'   THEN 1
                      WHEN 'ASOKAM'        THEN 7
                      WHEN 'LEFARMA'       THEN 8
                      WHEN 'CONSTRUMEDIKA' THEN 11
                      WHEN 'GRUPO LEFARMA' THEN 12
                    END
    FROM #rh r;

    /* Solo empleados cuya cuenta existe realmente en el AD de origen.
       El AD es la autoridad de autenticación de la app.                      */
    UPDATE r SET r.en_ad = 1
    FROM #rh r
    WHERE EXISTS (SELECT 1 FROM dbo.vwDirectorioActivo a
                  WHERE a.samAccountName = r.sam COLLATE DATABASE_DEFAULT
                    AND a.dominio        = r.dominio COLLATE DATABASE_DEFAULT);

    /* Un empleado por (sam, dominio): si RH trae duplicados, se reportan y se
       procesa uno solo.                                                       */
    IF OBJECT_ID('tempdb..#dups') IS NOT NULL DROP TABLE #dups;
    SELECT sam, dominio, COUNT(*) AS n
    INTO #dups
    FROM #rh GROUP BY sam, dominio HAVING COUNT(*) > 1;

    /* ================================================================
       Inicia transacción local (todo lo demás es mismo servidor)
       ================================================================ */
    BEGIN TRAN;

    /* --- 2) Corrección de Dominio ------------------------------------------
       Usuarios cuyo par (sam, dominio) NO existe en el AD pero que en el AD
       sí existen bajo el dominio derivado de su correo RH. Solo se mueve si
       no existiría colisión con otro usuario ya correcto.                    */
    DECLARE @tabla_dominio TABLE (IdUsuario INT, SamAccountName VARCHAR(256), DominioAntes VARCHAR(256), DominioNuevo VARCHAR(256));

    UPDATE u
        SET u.Dominio = r.dominio
    OUTPUT inserted.IdUsuario, inserted.SamAccountName, deleted.Dominio, inserted.Dominio INTO @tabla_dominio
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
     AND r.dominio <> u.Dominio COLLATE DATABASE_DEFAULT
    WHERE u.EsAnonimo = 0 AND u.EsRobot = 0
      AND NOT EXISTS (SELECT 1 FROM dbo.vwDirectorioActivo a
                      WHERE a.samAccountName = u.SamAccountName COLLATE DATABASE_DEFAULT
                        AND a.dominio = u.Dominio COLLATE DATABASE_DEFAULT)
      AND NOT EXISTS (SELECT 1 FROM app.usuarios x
                      WHERE x.SamAccountName = u.SamAccountName COLLATE DATABASE_DEFAULT
                        AND x.Dominio = r.dominio COLLATE DATABASE_DEFAULT
                        AND x.IdUsuario <> u.IdUsuario);

    /* --- 3) Corrección de correo -------------------------------------------
       Completa correos vacíos y alinea los distintos (comparación CI).       */
    DECLARE @tabla_correo TABLE (IdUsuario INT, CorreoAntes VARCHAR(512), CorreoNuevo VARCHAR(512));

    UPDATE u
        SET u.Correo = r.correo
    OUTPUT inserted.IdUsuario, deleted.Correo, inserted.Correo INTO @tabla_correo
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
    WHERE u.EsAnonimo = 0 AND u.EsRobot = 0
      AND (u.Correo IS NULL OR LTRIM(RTRIM(u.Correo)) = '' OR u.Correo COLLATE DATABASE_DEFAULT <> r.correo);

    /* --- 3b) Normalización de nombre ---------------------------------------
       Quita el prefijo de cuenta que el AD pega al displayName
       (ej. '1a1 Luis Antonio Pozo Urquizo' -> 'Luis Antonio Pozo Urquizo').
       Reglas (solo tocan nombres generados mecánicamente):
       3b.1) Nombre con prefijo de cuenta + match en RH  -> nombre limpio de RH.
       3b.2) Difiere de RH solo en espacios               -> nombre de RH.
       3b.3) Nombre con prefijo de cuenta sin match en RH -> solo se recorta
             el prefijo (ej. '1a31 Vacante Coordinador CEDIS' ->
             'Vacante Coordinador CEDIS').
       Las etiquetas sin prefijo ('Vacante Consultor CVS', 'Marco Castillo',
       etc.) NO se tocan: siguen en REVISAR_NOMBRE para revisión manual.     */
    DECLARE @tabla_nombres TABLE (IdUsuario INT, NombreAntes NVARCHAR(512), NombreNuevo NVARCHAR(512));

    UPDATE u
        SET u.NombreCompleto = app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,'')))
    OUTPUT deleted.IdUsuario, deleted.NombreCompleto, inserted.NombreCompleto INTO @tabla_nombres
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
    WHERE u.EsAnonimo = 0
      AND LEFT(u.NombreCompleto, LEN(u.SamAccountName) + 1) = u.SamAccountName + ' '
      AND u.NombreCompleto COLLATE DATABASE_DEFAULT <> app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,'')));

    UPDATE u
        SET u.NombreCompleto = app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,'')))
    OUTPUT deleted.IdUsuario, deleted.NombreCompleto, inserted.NombreCompleto INTO @tabla_nombres
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
    WHERE u.EsAnonimo = 0
      AND REPLACE(u.NombreCompleto, ' ', '') COLLATE DATABASE_DEFAULT =
          REPLACE(app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,''))), ' ', '')
      AND u.NombreCompleto COLLATE DATABASE_DEFAULT <> app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,'')));

    UPDATE u
        SET u.NombreCompleto = LTRIM(SUBSTRING(u.NombreCompleto, LEN(u.SamAccountName) + 2, 512))
    OUTPUT deleted.IdUsuario, deleted.NombreCompleto, inserted.NombreCompleto INTO @tabla_nombres
    FROM app.usuarios u
    WHERE u.EsAnonimo = 0
      AND u.SamAccountName IS NOT NULL
      AND LEFT(u.NombreCompleto, LEN(u.SamAccountName) + 1) = u.SamAccountName + ' '
      AND NOT EXISTS (SELECT 1 FROM #rh r
                      WHERE r.en_ad = 1
                        AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT);

    /* --- 4) Altas -----------------------------------------------------------
       Empleados RH con correo + nómina y cuenta viva en AD que aún no están. */
    DECLARE @tabla_altas TABLE (IdUsuario INT, SamAccountName VARCHAR(256), Dominio VARCHAR(256), Correo VARCHAR(512));

    INSERT INTO app.usuarios
        (SamAccountName, Dominio, NombreCompleto, Correo, EsAnonimo, EsActivo, EsRobot, FechaCreacion, Puesto)
    OUTPUT inserted.IdUsuario, inserted.SamAccountName, inserted.Dominio, inserted.Correo INTO @tabla_altas
    SELECT DISTINCT
        r.sam,
        r.dominio,
        app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,''))),
        r.correo,
        0, 1, 0,
        GETDATE(),
        ISNULL(app.fn_Capitaliza(r.puesto), 'Sin asignar')
    FROM #rh r
    WHERE r.en_ad = 1
      AND NOT EXISTS (SELECT 1 FROM app.usuarios u
                      WHERE u.SamAccountName = r.sam COLLATE DATABASE_DEFAULT
                        AND u.Dominio = r.dominio COLLATE DATABASE_DEFAULT);

    /* --- 5) config.usuario_detalle: alta y mantenimiento --------------------
       Alta: todo usuario con match RH que no tenga detalle (nuevos y
       existentes sin detalle).numero_empleado = nómina RH.
       Mantenimiento: completa numero_empleado vacío y puesto.                */
    DECLARE @tabla_detalle TABLE (IdUsuario INT, Accion VARCHAR(10));

    INSERT INTO Lefarma.config.usuario_detalle
        (id_usuario, id_empresa, id_sucursal, puesto, numero_empleado,
         firma_documento, notificar_email, notificar_app, activo, fecha_creacion)
    OUTPUT inserted.id_usuario, 'ALTA' INTO @tabla_detalle
    SELECT
        u.IdUsuario,
        r.emp_id,
        CASE r.emp_id
            WHEN 1 THEN @suc_default_artricenter
            WHEN 7 THEN @suc_default_asokam
            WHEN 8 THEN @suc_default_lefarma
            WHEN 11 THEN @suc_default_construmedika
            WHEN 12 THEN @suc_default_grupolefarma
        END,
        app.fn_Capitaliza(r.puesto),
        CAST(r.nomina AS VARCHAR(50)),
        0, 1, 1,
        u.EsActivo,
        GETDATE()
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
    WHERE r.emp_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM Lefarma.config.usuario_detalle d WHERE d.id_usuario = u.IdUsuario);

    UPDATE d
        SET d.numero_empleado = CAST(r.nomina AS VARCHAR(50)),
            d.fecha_modificacion = GETDATE()
    OUTPUT inserted.id_usuario, 'NOMINA' INTO @tabla_detalle
    FROM Lefarma.config.usuario_detalle d
    JOIN app.usuarios u ON u.IdUsuario = d.id_usuario
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
    WHERE (d.numero_empleado IS NULL OR LTRIM(RTRIM(d.numero_empleado)) = '');

    /* --- 5b) Cambio de titular (correo reasignado a nuevo ingreso) ---------
       A veces dan de baja a alguien y su MISMO correo se le asigna a una
       persona de nuevo ingreso: la cuenta (sam) se conserva, pero cambia la
       persona — otro número de nómina. Se detecta porque
       usuario_detalle.numero_empleado todavía guarda la nómina ANTERIOR y ese
       correo matchea ahora una nómina DISTINTA en RH. Entonces se renueva la
       identidad completa desde RH (nombre, nómina, puesto, empresa/sucursal)
       y se reporta como CAMBIO_TITULAR en el correo de acciones.
       Notas:
       - Si numero_empleado está vacío o ilegible NO se toca el nombre: ese
         caso queda en REVISAR_NOMBRE para revisión manual.
       - Una simple corrección de nómina en RH también cae aquí; refrescar
         desde RH es seguro porque RH es la fuente de verdad.
       - Si RH no trae nombre/puesto, se conservan los actuales (no se
         escriben vacíos). */
    DECLARE @tabla_titular TABLE (
        IdUsuario INT, SamAccountName VARCHAR(256),
        NominaAntes VARCHAR(50), NominaNuevo BIGINT,
        NombreAntes NVARCHAR(512), NombreNuevo NVARCHAR(512),
        PuestoNuevo NVARCHAR(300), EmpIdNuevo INT, SucursalNueva INT);

    INSERT INTO @tabla_titular (IdUsuario, SamAccountName, NominaAntes, NominaNuevo,
                                NombreAntes, NombreNuevo, PuestoNuevo, EmpIdNuevo, SucursalNueva)
    SELECT DISTINCT
        u.IdUsuario, u.SamAccountName, d.numero_empleado, r.nomina,
        u.NombreCompleto,
        NULLIF(app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,''))), ''),
        NULLIF(app.fn_Capitaliza(RTRIM(ISNULL(r.puesto,''))), ''),
        r.emp_id,
        CASE r.emp_id
            WHEN 1 THEN @suc_default_artricenter
            WHEN 7 THEN @suc_default_asokam
            WHEN 8 THEN @suc_default_lefarma
            WHEN 11 THEN @suc_default_construmedika
            WHEN 12 THEN @suc_default_grupolefarma
        END
    FROM app.usuarios u
    JOIN Lefarma.config.usuario_detalle d ON d.id_usuario = u.IdUsuario
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
     AND r.dominio = u.Dominio COLLATE DATABASE_DEFAULT
    WHERE u.EsAnonimo = 0
      AND TRY_CAST(LTRIM(RTRIM(d.numero_empleado)) AS BIGINT) IS NOT NULL
      AND TRY_CAST(LTRIM(RTRIM(d.numero_empleado)) AS BIGINT) <> r.nomina;

    UPDATE u
        SET u.NombreCompleto = ISNULL(t.NombreNuevo, u.NombreCompleto),
            u.Puesto = ISNULL(t.PuestoNuevo, u.Puesto)
    FROM app.usuarios u
    JOIN @tabla_titular t ON t.IdUsuario = u.IdUsuario;

    UPDATE d
        SET d.numero_empleado = CAST(t.NominaNuevo AS VARCHAR(50)),
            d.puesto = ISNULL(t.PuestoNuevo, d.puesto),
            d.id_empresa = ISNULL(t.EmpIdNuevo, d.id_empresa),
            d.id_sucursal = ISNULL(t.SucursalNueva, d.id_sucursal),
            d.fecha_modificacion = GETDATE()
    FROM Lefarma.config.usuario_detalle d
    JOIN @tabla_titular t ON t.IdUsuario = d.id_usuario;

    /* --- 5c) Liberación de correo heredado (opción A) -----------------------
       Un correo "pertenece" a la cuenta derivada de él mismo: sam = parte
       local + dominio = sufijo. Cuando dan de baja a alguien y después su
       correo se le asigna a un nuevo ingreso, a veces la fila vieja quedó con
       un (sam, dominio) que ya no corresponde a ese correo (p.ej. dominio
       viejo) y se crea una fila nueva: dos filas con el MISMO correo.
       Aquí la fila ACTIVA que reclama el correo (su sam+dominio derivado
       coincide con ella) se lo quita a la fila fantasma (en baja):
       Correo = NULL, conservando nombre, nómina y sam como histórico.
       REGLAS DE SEGURIDAD:
       - Solo se libera desde filas DESACTIVADAS (EsActivo = 0).
       - @excepciones_baja (Hector Velez) jamás se toca.
       - Si dos filas ACTIVAS comparten correo, NO se libera nada: solo se
         reporta CORREO_DUPLICADO para que una persona decida. */
    DECLARE @tabla_libera TABLE (IdUsuario INT, SamAccountName VARCHAR(256),
                                 Dominio VARCHAR(256), CorreoAntes VARCHAR(512),
                                 NombreCompleto NVARCHAR(512));

    UPDATE u
        SET u.Correo = NULL
    OUTPUT deleted.IdUsuario, deleted.SamAccountName, deleted.Dominio,
           deleted.Correo, deleted.NombreCompleto
        INTO @tabla_libera
    FROM app.usuarios u
    WHERE u.EsActivo = 0
      AND u.EsAnonimo = 0
      AND u.EsRobot = 0
      AND u.SamAccountName IS NOT NULL
      AND u.Correo IS NOT NULL AND LTRIM(RTRIM(u.Correo)) <> ''
      AND u.Correo LIKE '%@%'
      AND NOT EXISTS (SELECT 1 FROM @excepciones_baja x
                      WHERE x.SamAccountName = u.SamAccountName COLLATE DATABASE_DEFAULT
                        AND x.Dominio = u.Dominio COLLATE DATABASE_DEFAULT)
      /* La fila fantasma NO es la dueña derivada del correo... */
      AND (u.SamAccountName <> LEFT(LTRIM(RTRIM(u.Correo)), CHARINDEX('@', LTRIM(RTRIM(u.Correo))) - 1)
           OR ISNULL(u.Dominio, '') <> CASE
                 WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@grupolefarma.com.mx' THEN 'Grupolefarma'
                 WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@asokam.mx'           THEN 'Asokam'
                 WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@lefarma.com.mx'      THEN 'Lefarma'
                 WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@artricenter.com.mx'  THEN 'Artricenter'
                 WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@construmedika.com'   THEN 'Construmedika'
               END)
      /* ...y existe una fila ACTIVA que SÍ es la dueña derivada de ese correo. */
      AND EXISTS (SELECT 1 FROM app.usuarios a
                  WHERE a.EsActivo = 1
                    AND a.IdUsuario <> u.IdUsuario
                    AND LTRIM(RTRIM(a.Correo)) = LTRIM(RTRIM(u.Correo)) COLLATE DATABASE_DEFAULT
                    AND a.SamAccountName = LEFT(LTRIM(RTRIM(u.Correo)), CHARINDEX('@', LTRIM(RTRIM(u.Correo))) - 1) COLLATE DATABASE_DEFAULT
                    AND a.Dominio = CASE
                          WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@grupolefarma.com.mx' THEN 'Grupolefarma'
                          WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@asokam.mx'           THEN 'Asokam'
                          WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@lefarma.com.mx'      THEN 'Lefarma'
                          WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@artricenter.com.mx'  THEN 'Artricenter'
                          WHEN LTRIM(RTRIM(u.Correo)) LIKE '%@construmedika.com'   THEN 'Construmedika'
                        END COLLATE DATABASE_DEFAULT);

    /* Dos filas ACTIVAS con el mismo correo: no se toca nada, solo se
       reporta (CORREO_DUPLICADO). */
    DECLARE @tabla_correo_dup TABLE (Correo VARCHAR(512), Filas INT, Detalle NVARCHAR(1000));

    INSERT INTO @tabla_correo_dup (Correo, Filas, Detalle)
    SELECT d.Correo, d.Filas, d.Detalle
    FROM (SELECT LTRIM(RTRIM(u.Correo)) AS Correo, COUNT(*) AS Filas,
                 STRING_AGG(CAST(u.IdUsuario AS VARCHAR(10)) + ':' + u.SamAccountName, ' | ') AS Detalle
          FROM app.usuarios u
          WHERE u.EsActivo = 1
            AND u.EsAnonimo = 0
            AND u.Correo IS NOT NULL AND LTRIM(RTRIM(u.Correo)) <> ''
            AND u.Correo LIKE '%@%'
          GROUP BY LTRIM(RTRIM(u.Correo))
          HAVING COUNT(*) > 1) AS d;

    /* --- 6) Desactivación de bajas (SOFT) -----------------------------------
       BAJA SOFT: solo EsActivo = 0. El SP NUNCA ejecuta DELETE — todo el
       historial queda intacto y el propio SP reactiva la cuenta si la persona
       reaparece en vwEmpleados.
       Usuarios de AD activos (no anónimos, no robots) que ya NO están en RH:
       ni por (sam, dominio) derivado del correo, ni por nómina vía AD.
       Se desactiva usuario y su detalle. No se tocan cuentas sin verificación
       de AD (en_ad = 0) — esas se reportan aparte. Las cuentas de
       @excepciones_baja jamás se desactivan. Ver LISTA DE BAJAS al final.    */
    DECLARE @tabla_bajas TABLE (IdUsuario INT, SamAccountName VARCHAR(256), Dominio VARCHAR(256), NombreCompleto NVARCHAR(512));

    UPDATE u
        SET u.EsActivo = 0
    OUTPUT deleted.IdUsuario, deleted.SamAccountName, deleted.Dominio, deleted.NombreCompleto INTO @tabla_bajas
    FROM app.usuarios u
    WHERE u.EsActivo = 1
      AND u.EsAnonimo = 0
      AND u.EsRobot = 0
      AND u.SamAccountName IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM @excepciones_baja x
                      WHERE x.SamAccountName = u.SamAccountName COLLATE DATABASE_DEFAULT
                        AND x.Dominio = u.Dominio COLLATE DATABASE_DEFAULT)
      AND EXISTS (SELECT 1 FROM dbo.vwDirectorioActivo a
                  WHERE a.samAccountName = u.SamAccountName COLLATE DATABASE_DEFAULT
                    AND a.dominio = u.Dominio COLLATE DATABASE_DEFAULT)
      AND NOT EXISTS (SELECT 1 FROM #rh r
                      WHERE r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
                        AND r.dominio = u.Dominio COLLATE DATABASE_DEFAULT)
      AND NOT EXISTS (
            SELECT 1
            FROM #rh r2
            JOIN dbo.vwDirectorioActivo a2
              ON a2.samAccountName = r2.sam COLLATE DATABASE_DEFAULT
             AND a2.dominio = r2.dominio COLLATE DATABASE_DEFAULT
            WHERE TRY_CAST(a2.numeroNomina AS BIGINT) = r2.nomina
              AND a2.samAccountName = u.SamAccountName COLLATE DATABASE_DEFAULT
              AND a2.dominio = u.Dominio COLLATE DATABASE_DEFAULT);

    UPDATE d
        SET d.activo = 0, d.fecha_modificacion = GETDATE()
    FROM Lefarma.config.usuario_detalle d
    JOIN app.usuarios u ON u.IdUsuario = d.id_usuario
    WHERE u.EsActivo = 0 AND d.activo = 1;

    /* --- 7) Reactivación ----------------------------------------------------
       Usuarios inactivos que volvieron a estar en RH.                        */
    DECLARE @tabla_reactivados TABLE (IdUsuario INT, SamAccountName VARCHAR(256));

    UPDATE u
        SET u.EsActivo = 1
    OUTPUT inserted.IdUsuario, inserted.SamAccountName INTO @tabla_reactivados
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
     AND r.dominio = u.Dominio COLLATE DATABASE_DEFAULT
    WHERE u.EsActivo = 0 AND u.EsAnonimo = 0 AND u.EsRobot = 0;

    UPDATE d
        SET d.activo = 1, d.fecha_modificacion = GETDATE()
    FROM Lefarma.config.usuario_detalle d
    JOIN app.usuarios u ON u.IdUsuario = d.id_usuario
    WHERE u.EsActivo = 1 AND d.activo = 0;

    COMMIT;

    /* ================================================================
       REPORTES
       ================================================================ */

    SELECT 'CORRECCION_DOMINIO' AS accion, IdUsuario, SamAccountName, DominioAntes, DominioNuevo
    FROM @tabla_dominio
    UNION ALL
    SELECT 'CORRECCION_CORREO', IdUsuario, ISNULL(CorreoAntes,'(vacío)'), CorreoNuevo, NULL
    FROM @tabla_correo
    ORDER BY accion, IdUsuario;

    SELECT 'ALTA' AS accion, IdUsuario, SamAccountName, Dominio, Correo FROM @tabla_altas;

    SELECT 'DETALLE' AS accion, IdUsuario, Accion AS accion_detalle FROM @tabla_detalle;

    /* Cambio de titular: mismo correo, persona distinta (nómina distinta).   */
    SELECT 'CAMBIO_TITULAR' AS accion, IdUsuario, SamAccountName,
           NominaAntes, NominaNuevo, NombreAntes, NombreNuevo
    FROM @tabla_titular;

    /* Correo liberado a filas fantasma (en baja) que ya no son las dueñas.  */
    SELECT 'LIBERA_CORREO' AS accion, IdUsuario, SamAccountName, Dominio,
           CorreoAntes, NombreCompleto
    FROM @tabla_libera;

    /* Dos filas ACTIVAS con el mismo correo: decisión manual. */
    SELECT 'CORREO_DUPLICADO' AS accion, Correo, Filas, Detalle
    FROM @tabla_correo_dup;

    SELECT 'BAJA' AS accion, IdUsuario, SamAccountName, Dominio, NombreCompleto
    FROM @tabla_bajas
    UNION ALL
    SELECT 'REACTIVACION', IdUsuario, SamAccountName, NULL, NULL
    FROM @tabla_reactivados;

    SELECT 'NORMALIZA_NOMBRE' AS accion, IdUsuario, NombreAntes, NombreNuevo
    FROM @tabla_nombres;

    /* Nombres por revisar: difieren de RH y NO son prefijo de cuenta ni
        espacios (etiquetas manuales tipo "Vacante X", apodos, erratas).
        No se corrigen automáticamente: los decide RH. Se capturan en #revisar
        para el resultset y para el correo con el script sugerido. */
    IF OBJECT_ID('tempdb..#revisar') IS NOT NULL DROP TABLE #revisar;
    SELECT u.IdUsuario, u.SamAccountName, u.Dominio,
           u.NombreCompleto AS nombre_app,
           app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,''))) AS nombre_rh
    INTO #revisar
    FROM app.usuarios u
    JOIN #rh r
      ON r.en_ad = 1
     AND r.sam = u.SamAccountName COLLATE DATABASE_DEFAULT
    WHERE u.EsAnonimo = 0
      AND u.NombreCompleto COLLATE DATABASE_DEFAULT <>
          app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,'')));

    SELECT 'REVISAR_NOMBRE' AS accion, IdUsuario, SamAccountName, Dominio, nombre_app, nombre_rh
    FROM #revisar;

    /* Empleados RH con correo+nómina que NO pueden crearse porque su cuenta
       no existe en el AD bajo el dominio derivado de su correo.               */
    SELECT 'PENDIENTE_SIN_AD' AS accion, r.nomina,
           app.fn_Capitaliza(RTRIM(ISNULL(r.nombre,'')) + ' ' + RTRIM(ISNULL(r.apellidos,''))) AS empleado,
           r.correo, r.dominio, r.empresa
    FROM #rh r
    WHERE r.en_ad = 0;

    /* Duplicados RH por (sam, dominio) — no se procesan automáticamente.      */
    SELECT 'DUPLICADO_RH' AS accion, sam, dominio, n FROM #dups;

    /* ================================================================
       NOTIFICACIONES POR CORREO (app.sp_enviar_correo)
       Cada correo sale solo si su reporte tuvo filas ("si hubo alguna
       acción"). Destinatario: @correo_notifica (NULL o '' = no enviar).
       Un fallo del correo NO revierte ni rompe la sincronización (los
       datos ya hicieron COMMIT).
       ================================================================ */
    IF @correo_notifica IS NOT NULL AND LTRIM(RTRIM(@correo_notifica)) <> ''
    BEGIN
        DECLARE @remitente VARCHAR(256) = 'autorizaciones@grupolefarma.com.mx';
        DECLARE @html   NVARCHAR(MAX);
        DECLARE @script NVARCHAR(MAX);
        DECLARE @asunto NVARCHAR(300);
        DECLARE @n      INT;

        BEGIN TRY
            /* --- Correo 1: ACCIONES (las 4 tablas previas a NORMALIZA_NOMBRE) --- */
            IF EXISTS (SELECT 1 FROM @tabla_dominio)  OR EXISTS (SELECT 1 FROM @tabla_correo)
               OR EXISTS (SELECT 1 FROM @tabla_altas) OR EXISTS (SELECT 1 FROM @tabla_detalle)
               OR EXISTS (SELECT 1 FROM @tabla_titular)
               OR EXISTS (SELECT 1 FROM @tabla_libera) OR EXISTS (SELECT 1 FROM @tabla_correo_dup)
               OR EXISTS (SELECT 1 FROM @tabla_bajas) OR EXISTS (SELECT 1 FROM @tabla_reactivados)
            BEGIN
                SET @html = N'<div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#222">'
                    + N'<h2 style="margin:0 0 4px 0;color:#2d3142">Sincronización de usuarios — acciones</h2>'
                    + N'<p style="margin:0 0 12px 0;color:#666">' + CONVERT(VARCHAR(19), GETDATE(), 120) + N'</p>';

                IF EXISTS (SELECT 1 FROM @tabla_dominio) OR EXISTS (SELECT 1 FROM @tabla_correo)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Correcciones de dominio y correo</h3>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>Acción</th><th>IdUsuario</th><th>Cuenta</th><th>Antes</th><th>Nuevo</th></tr>';

                    SELECT @html += N'<tr><td>CORRECCION_DOMINIO</td><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(SamAccountName, '')
                        + N'</td><td>' + ISNULL(DominioAntes, '')
                        + N'</td><td>' + ISNULL(DominioNuevo, '') + N'</td></tr>'
                    FROM @tabla_dominio;

                    SELECT @html += N'<tr><td>CORRECCION_CORREO</td><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td></td><td>' + ISNULL(CorreoAntes, '(vacío)')
                        + N'</td><td>' + ISNULL(CorreoNuevo, '') + N'</td></tr>'
                    FROM @tabla_correo;

                    SET @html += N'</table>';
                END;

                IF EXISTS (SELECT 1 FROM @tabla_altas)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Altas de usuarios</h3>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>IdUsuario</th><th>Cuenta</th><th>Dominio</th><th>Correo</th></tr>';

                    SELECT @html += N'<tr><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(SamAccountName, '')
                        + N'</td><td>' + ISNULL(Dominio, '')
                        + N'</td><td>' + ISNULL(Correo, '') + N'</td></tr>'
                    FROM @tabla_altas;

                    SET @html += N'</table>';
                END;

                IF EXISTS (SELECT 1 FROM @tabla_detalle)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Detalle (usuario_detalle)</h3>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>IdUsuario</th><th>Acción</th></tr>';

                    SELECT @html += N'<tr><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(Accion, '') + N'</td></tr>'
                    FROM @tabla_detalle;

                    SET @html += N'</table>';
                END;

                IF EXISTS (SELECT 1 FROM @tabla_titular)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Cambios de titular (mismo correo, nueva persona)</h3>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>IdUsuario</th><th>Cuenta</th><th>Nómina antes</th><th>Nómina nueva</th><th>Nombre antes</th><th>Nombre nuevo</th></tr>';

                    SELECT @html += N'<tr><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(SamAccountName, '')
                        + N'</td><td>' + ISNULL(NominaAntes, '')
                        + N'</td><td>' + CAST(NominaNuevo AS VARCHAR(20))
                        + N'</td><td>' + ISNULL(NombreAntes, '')
                        + N'</td><td>' + ISNULL(NombreNuevo, '') + N'</td></tr>'
                    FROM @tabla_titular;

                    SET @html += N'</table>';
                END;

                IF EXISTS (SELECT 1 FROM @tabla_libera)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Correos liberados de filas en baja (ya no eran los dueños)</h3>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>IdUsuario</th><th>Cuenta</th><th>Dominio</th><th>Correo que se liberó</th><th>Nombre (histórico)</th></tr>';

                    SELECT @html += N'<tr><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(SamAccountName, '')
                        + N'</td><td>' + ISNULL(Dominio, '')
                        + N'</td><td>' + ISNULL(CorreoAntes, '')
                        + N'</td><td>' + ISNULL(NombreCompleto, '') + N'</td></tr>'
                    FROM @tabla_libera;

                    SET @html += N'</table>';
                END;

                IF EXISTS (SELECT 1 FROM @tabla_correo_dup)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Correos duplicados entre filas ACTIVAS — decidir manualmente</h3>'
                        + N'<p style="margin:0 0 8px 0;color:#666">Estos correos NO se tocaron: hay más de una fila activa con el mismo correo.</p>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>Correo</th><th>Filas</th><th>Detalle (IdUsuario:cuenta)</th></tr>';

                    SELECT @html += N'<tr><td>' + ISNULL(Correo, '')
                        + N'</td><td>' + CAST(Filas AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(Detalle, '') + N'</td></tr>'
                    FROM @tabla_correo_dup;

                    SET @html += N'</table>';
                END;

                IF EXISTS (SELECT 1 FROM @tabla_bajas) OR EXISTS (SELECT 1 FROM @tabla_reactivados)
                BEGIN
                    SET @html += N'<h3 style="margin:12px 0 4px 0">Bajas y reactivaciones</h3>'
                        + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                        + N'<tr style="background:#eb6c36;color:#fff"><th>Acción</th><th>IdUsuario</th><th>Cuenta</th><th>Dominio</th><th>Nombre</th></tr>';

                    SELECT @html += N'<tr><td>BAJA</td><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(SamAccountName, '')
                        + N'</td><td>' + ISNULL(Dominio, '')
                        + N'</td><td>' + ISNULL(NombreCompleto, '') + N'</td></tr>'
                    FROM @tabla_bajas;

                    SELECT @html += N'<tr><td>REACTIVACION</td><td>' + CAST(IdUsuario AS VARCHAR(10))
                        + N'</td><td>' + ISNULL(SamAccountName, '')
                        + N'</td><td></td><td></td></tr>'
                    FROM @tabla_reactivados;

                    SET @html += N'</table>';
                END;

                SET @html += N'</div>';

                SELECT @n = (SELECT COUNT(*) FROM @tabla_dominio) + (SELECT COUNT(*) FROM @tabla_correo)
                           + (SELECT COUNT(*) FROM @tabla_altas)  + (SELECT COUNT(*) FROM @tabla_detalle)
                           + (SELECT COUNT(*) FROM @tabla_titular)
                           + (SELECT COUNT(*) FROM @tabla_libera)  + (SELECT COUNT(*) FROM @tabla_correo_dup)
                           + (SELECT COUNT(*) FROM @tabla_bajas)  + (SELECT COUNT(*) FROM @tabla_reactivados);

                SET @asunto = N'Sincronización usuarios — acciones (' + CAST(@n AS VARCHAR(10)) + N')';

                EXEC app.sp_enviar_correo
                     @correo_remitente = @remitente,
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto,
                     @destinatarios    = @correo_notifica,
                     @body_html        = @html;
            END;

            /* --- Correo 2: NOMBRES CORREGIDOS (NORMALIZA_NOMBRE) --- */
            IF EXISTS (SELECT 1 FROM @tabla_nombres)
            BEGIN
                SET @html = N'<div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#222">'
                    + N'<h2 style="margin:0 0 4px 0;color:#2d3142">Sincronización de usuarios — nombres corregidos</h2>'
                    + N'<p style="margin:0 0 12px 0;color:#666">' + CONVERT(VARCHAR(19), GETDATE(), 120) + N'</p>'
                    + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                    + N'<tr style="background:#eb6c36;color:#fff"><th>IdUsuario</th><th>Nombre antes</th><th>Nombre nuevo</th></tr>';

                SELECT @html += N'<tr><td>' + CAST(IdUsuario AS VARCHAR(10))
                    + N'</td><td>' + ISNULL(NombreAntes, '')
                    + N'</td><td>' + ISNULL(NombreNuevo, '') + N'</td></tr>'
                FROM @tabla_nombres;

                SET @html += N'</table></div>';

                SELECT @n = COUNT(*) FROM @tabla_nombres;
                SET @asunto = N'Sincronización usuarios — nombres corregidos (' + CAST(@n AS VARCHAR(10)) + N')';

                EXEC app.sp_enviar_correo
                     @correo_remitente = @remitente,
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto,
                     @destinatarios    = @correo_notifica,
                     @body_html        = @html;
            END;

            /* --- Correo 3: REVISAR_NOMBRE (no se corrigen; va el script) --- */
            IF EXISTS (SELECT 1 FROM #revisar)
            BEGIN
                /* Diff palabra por palabra entre la app y RH: qué falta en la
                   app, qué sobra, y si solo difiere en acentos/ortografía. */
                DECLARE @falta TABLE (IdUsuario INT, p NVARCHAR(256) COLLATE DATABASE_DEFAULT);
                DECLARE @sobra TABLE (IdUsuario INT, p NVARCHAR(256) COLLATE DATABASE_DEFAULT);
                DECLARE @dif   TABLE (IdUsuario INT, dif NVARCHAR(MAX) COLLATE DATABASE_DEFAULT);

                INSERT INTO @falta (IdUsuario, p)
                SELECT IdUsuario, p
                FROM (SELECT r.IdUsuario, LTRIM(RTRIM(s.value)) AS p
                      FROM #revisar r CROSS APPLY STRING_SPLIT(r.nombre_rh, ' ') AS s
                      WHERE LTRIM(RTRIM(s.value)) <> '') AS rh
                EXCEPT
                SELECT IdUsuario, p
                FROM (SELECT r.IdUsuario, LTRIM(RTRIM(s.value)) AS p
                      FROM #revisar r CROSS APPLY STRING_SPLIT(r.nombre_app, ' ') AS s
                      WHERE LTRIM(RTRIM(s.value)) <> '') AS ap;

                INSERT INTO @sobra (IdUsuario, p)
                SELECT IdUsuario, p
                FROM (SELECT r.IdUsuario, LTRIM(RTRIM(s.value)) AS p
                      FROM #revisar r CROSS APPLY STRING_SPLIT(r.nombre_app, ' ') AS s
                      WHERE LTRIM(RTRIM(s.value)) <> '') AS ap
                EXCEPT
                SELECT IdUsuario, p
                FROM (SELECT r.IdUsuario, LTRIM(RTRIM(s.value)) AS p
                      FROM #revisar r CROSS APPLY STRING_SPLIT(r.nombre_rh, ' ') AS s
                      WHERE LTRIM(RTRIM(s.value)) <> '') AS rh;

                INSERT INTO @dif (IdUsuario, dif)
                SELECT v.IdUsuario,
                       CASE WHEN f.fal IS NULL AND o.sob IS NULL
                            THEN N'difiere solo en acentos/ortografía/espacios'
                            ELSE LTRIM(CASE WHEN f.fal IS NOT NULL
                                            THEN N'Falta en la app: ' + f.fal + N'. ' ELSE N'' END
                                     + CASE WHEN o.sob IS NOT NULL
                                            THEN N'Sobra en la app: ' + o.sob + N'.' ELSE N'' END)
                       END
                FROM #revisar v
                LEFT JOIN (SELECT IdUsuario, STRING_AGG(p, N', ') AS fal FROM @falta GROUP BY IdUsuario) AS f
                       ON f.IdUsuario = v.IdUsuario
                LEFT JOIN (SELECT IdUsuario, STRING_AGG(p, N', ') AS sob FROM @sobra GROUP BY IdUsuario) AS o
                       ON o.IdUsuario = v.IdUsuario;

                SELECT @script = (
                    SELECT CHAR(13) + CHAR(10)
                         + N'-- IdUsuario ' + CAST(IdUsuario AS VARCHAR(10)) + N' (' + ISNULL(SamAccountName, '') + N'): '
                         + ISNULL(nombre_app, '') + N' -> ' + ISNULL(nombre_rh, '') + CHAR(13) + CHAR(10)
                         + N'UPDATE app.usuarios SET NombreCompleto = N''' + REPLACE(ISNULL(nombre_rh, ''), '''', '''''')
                         + N''' WHERE IdUsuario = ' + CAST(IdUsuario AS VARCHAR(10)) + N';'
                    FROM #revisar
                    ORDER BY IdUsuario
                    FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)');

                SET @html = N'<div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#222">'
                    + N'<h2 style="margin:0 0 4px 0;color:#2d3142">Sincronización de usuarios — nombres por revisar</h2>'
                    + N'<p style="margin:0 0 12px 0;color:#666">' + CONVERT(VARCHAR(19), GETDATE(), 120)
                    + N' — estos nombres NO se corrigen automáticamente: los decide una persona.</p>'
                    + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                    + N'<tr style="background:#eb6c36;color:#fff"><th>IdUsuario</th><th>Cuenta</th><th>Dominio</th><th>Nombre en la app</th><th>Nombre en RH</th><th>¿Qué difiere?</th></tr>';

                SELECT @html += N'<tr><td>' + CAST(r.IdUsuario AS VARCHAR(10))
                    + N'</td><td>' + ISNULL(r.SamAccountName, '')
                    + N'</td><td>' + ISNULL(r.Dominio, '')
                    + N'</td><td>' + ISNULL(r.nombre_app, '')
                    + N'</td><td>' + ISNULL(r.nombre_rh, '')
                    + N'</td><td>' + ISNULL(d.dif, '') + N'</td></tr>'
                FROM #revisar r
                LEFT JOIN @dif d ON d.IdUsuario = r.IdUsuario;

                SET @html += N'</table>'
                    + N'<h3 style="margin:16px 0 4px 0">Script sugerido (revísalo y ajústalo antes de ejecutar)</h3>'
                    + N'<pre style="background:#f5f5f5;border:1px solid #ddd;padding:10px;font-size:12px;white-space:pre-wrap">'
                    + REPLACE(REPLACE(REPLACE(@script, N'&', N'&amp;'), N'<', N'&lt;'), N'>', N'&gt;')
                    + N'</pre></div>';

                SELECT @n = COUNT(*) FROM #revisar;
                SET @asunto = N'Sincronización usuarios — nombres por revisar (' + CAST(@n AS VARCHAR(10)) + N')';

                EXEC app.sp_enviar_correo
                     @correo_remitente = @remitente,
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto,
                     @destinatarios    = @correo_notifica,
                     @body_html        = @html;
            END;

            /* --- Correo 4: PENDIENTE_SIN_AD --- */
            IF EXISTS (SELECT 1 FROM #rh WHERE en_ad = 0)
            BEGIN
                SET @html = N'<div style="font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#222">'
                    + N'<h2 style="margin:0 0 4px 0;color:#2d3142">Sincronización de usuarios — pendientes sin cuenta en AD</h2>'
                    + N'<p style="margin:0 0 12px 0;color:#666">' + CONVERT(VARCHAR(19), GETDATE(), 120)
                    + N' — empleados de RH (vwEmpleados) cuya cuenta no existe en el Directorio Activo (no se pueden dar de alta).</p>'
                    + N'<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:12px">'
                    + N'<tr style="background:#eb6c36;color:#fff"><th>Nómina</th><th>Empleado</th><th>Correo</th><th>Dominio</th><th>Empresa</th></tr>';

                SELECT @html += N'<tr><td>' + CAST(r.nomina AS VARCHAR(20))
                    + N'</td><td>' + ISNULL(app.fn_Capitaliza(RTRIM(ISNULL(r.nombre, '')) + ' ' + RTRIM(ISNULL(r.apellidos, ''))), '')
                    + N'</td><td>' + ISNULL(r.correo, '')
                    + N'</td><td>' + ISNULL(r.dominio, '')
                    + N'</td><td>' + ISNULL(r.empresa, '') + N'</td></tr>'
                FROM #rh r
                WHERE r.en_ad = 0;

                SET @html += N'</table></div>';

                SELECT @n = COUNT(*) FROM #rh WHERE en_ad = 0;
                SET @asunto = N'Sincronización usuarios — pendientes sin cuenta AD (' + CAST(@n AS VARCHAR(10)) + N')';

                EXEC app.sp_enviar_correo
                     @correo_remitente = @remitente,
                     @nombre_remitente = N'noreplay',
                     @asunto           = @asunto,
                     @destinatarios    = @correo_notifica,
                     @body_html        = @html;
            END;
        END TRY
        BEGIN CATCH
            PRINT 'Notificación por correo falló (la sincronización SÍ se aplicó): ' + ERROR_MESSAGE();
        END CATCH
    END
END
GO

/* Verificación rápida (opcional):
   EXEC Asokam.app.sp_sincroniza_empleados_usuarios;
*/

/* ============================================================================
   LISTA DE BAJAS JUSTIFICADAS — snapshot 22-sep-2026
   ---------------------------------------------------------------------------
   CRITERIO DE BAJA (soft): la cuenta existe en el Directorio Activo y está
   activa en app.usuarios, pero la persona ya NO existe en
   Asistencias.dbo.vwEmpleados (RH = fuente de verdad de quién es empleado):
   ni su correo derivado (sam@dominio) ni su nómina (vía
   vwDirectorioActivo.numeroNomina) cruzan con ningún empleado activo. Sin
   empleado detrás, la cuenta seguiría pudiendo entrar a la app, aprobar
   workflows y recibir datos: por eso se desactiva (EsActivo = 0 y
   usuario_detalle.activo = 0).

   LA BAJA ES SOFT: no se borra NADA (el SP no contiene ningún DELETE).
   Todo el historial queda intacto y el SP REACTIVA la cuenta si la persona
   reaparece en vwEmpleados.

   EXCEPCIÓN (NO se da de baja): #20 'a' / Grupolefarma — Hector Velez.

   [17] carlos.guzman / Grupolefarma — "Carlos Guzman" (54@artricenter.com.mx)
        Registro duplicado/sobrante: el Carlos Guzmán real (Carlos Guzmán
        Casanova, nómina 1629309, TI) opera con la cuenta #21 (sam '54').
        Esta fila tiene correo de otra empresa y no cruza con RH.

   [26] 1a31 / Asokam — "1a31 Vacante Coordinador CEDIS" (1a31@asokam.mx)
        Cuenta de vacante/puesto: no hay empleado en nómina detrás.

   [31] 1a44 / Asokam — "Victor Hugo Feregrino Ramírez" (1a44@asokam.mx)
        Baja de RH: ya no aparece en vwEmpleados.

   [35] 38 / Grupolefarma — "38 Javier Vazquez Martinez" (38@grupolefarma.com.mx)
        CUENTA VIEJA: Javier Vazquez Martínez SÍ sigue activo en RH (nómina
        1427385) pero su cuenta nueva del AD es sam '3' (3@grupolefarma.com.mx).
        En esta misma corrida se le da de alta con la cuenta nueva (sección de
        altas) y se desactiva esta vieja: NO se pierde al usuario.

   [41] r1 / Artricenter — "Alejandro Bustos Marquez" (r1@artricenter.com.mx)
        Baja de RH: ya no aparece en vwEmpleados.

   [49] 1c3  / Lefarma — "Enrique Córdova Gomez"            (1c3@LEFARMA.COM.MX)
   [58] 1c31 / Lefarma — "Carlos Gilberto Torres Villareal" (1c31@LEFARMA.COM.MX)
   [59] 1c1  / Lefarma — "Oscar Mancilla"                   (1c1@LEFARMA.COM.MX)
   [60] 1c12 / Lefarma — "Erick Gutierrez Ramirez"         (1c12@lefarma.com.mx)
   [65] 1c47 / Lefarma — "Gustavo Armando Romero Bojorquez" (1c47@lefarma.com.mx)
        Bajas de RH: ninguno aparece en vwEmpleados (ex-empleados Lefarma).

   [76] 39 / Grupolefarma — "Juan Manuel Zamora Loera" (39@grupolefarma.com.mx)
        Baja de RH: ya no aparece en vwEmpleados.

   QUÉRIES DE VERIFICACIÓN (final del archivo, bloque IF 0 = 1):
   Para auditar cualquier caso, cambia @cuenta / @dominio / @nombre, pon
   IF 1 = 1 y ejecuta. Para una baja justificada: (1), (2) y (4) sin filas
   y (3) con fila. Si (1), (2) o (4) regresan filas: NO dar de baja.
   ============================================================================ */

IF 0 = 1 BEGIN
    /* --- Verificación de un caso de baja --------------------------------
       1) ¿Existe en RH por correo derivado (sam@...)?
       2) ¿Existe en RH por nombre?
       3) ¿Existe en el Directorio Activo?
       4) ¿Su nómina en el AD cruza con algún empleado de RH?                */
    DECLARE @cuenta  VARCHAR(256) = 'carlos.guzman',
            @dominio VARCHAR(256) = 'Grupolefarma',
            @nombre  VARCHAR(256) = 'GUZMAN';   -- se busca como %nombre%

    -- 1) RH por correo derivado
    SELECT 'RH-por-correo' AS busqueda, nomina, nombre, apellidos, correo,
           empresa, departamento, puesto
    FROM [ESFR-DOCTS].Asistencias.dbo.vwEmpleados
    WHERE LEFT(LTRIM(RTRIM(correo)), CHARINDEX('@', LTRIM(RTRIM(correo))) - 1) = @cuenta;

    -- 2) RH por nombre
    SELECT 'RH-por-nombre' AS busqueda, nomina, nombre, apellidos, correo,
           empresa, departamento, puesto
    FROM [ESFR-DOCTS].Asistencias.dbo.vwEmpleados
    WHERE (RTRIM(nombre) + ' ' + RTRIM(apellidos)) LIKE '%' + @nombre + '%';

    -- 3) Directorio Activo
    SELECT 'AD' AS busqueda, dominio, samAccountName, displayName, mail,
           numeroNomina, department
    FROM dbo.vwDirectorioActivo
    WHERE samAccountName = @cuenta;

    -- 4) Cruce de nómina AD <-> RH
    SELECT 'CRUCE-NOMINA' AS busqueda, e.nomina, e.nombre, e.correo
    FROM [ESFR-DOCTS].Asistencias.dbo.vwEmpleados e
    JOIN dbo.vwDirectorioActivo a ON TRY_CAST(a.numeroNomina AS BIGINT) = e.nomina
    WHERE a.samAccountName = @cuenta AND a.dominio = @dominio;
END
