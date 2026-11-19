-- =====================================================================
-- SIGMA - Procedimientos almacenados del modulo de documentos (BD Asokam)
-- =====================================================================
-- FUENTE: AsokamDev (Server=192.168.4.2), 2026-11-19. Extraccion de solo
-- lectura desde sys.sql_modules. Huellas SHA256 verificadas: identicas
-- byte a byte entre AsokamDev y Asokam (produccion).
--
-- ESTE ARCHIVO ES DE REFERENCIA. NO se aplica por el migrador de la BD de
-- negocio Lefarma ni por los despliegues: los SP viven en la BD Asokam y
-- ya existen en dev y produccion. Sirve para versionar su definicion real
-- y poder auditarlas; ver README.md.
--
-- Formato: CREATE OR ALTER PROCEDURE para poder reaplicar el objeto en
-- Asokam sin borrarlo (solo si un humano lo decide).
-- =====================================================================
-- ===== -- ===== sp_ActualizarFirmaUsuario =====

CREATE OR ALTER PROCEDURE [app].[sp_ActualizarFirmaUsuario]
    @SamAccountName NVARCHAR(255),
    @Dominio NVARCHAR(255),
    @PathFirma NVARCHAR(500),
    @IdentificadorFirma NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MetadataJson NVARCHAR(MAX);

    -- Crear JSON con la firma
    SET @MetadataJson = '{"tieneFirma":true,"pathFirma":"' + @PathFirma + '","identificadorFirma":"' + @IdentificadorFirma + '"}';

    UPDATE [app].[Usuarios]
    SET MetadataJson = @MetadataJson
    WHERE SamAccountName = @SamAccountName AND Dominio = @Dominio;

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('Usuario no encontrado', 16, 1);
    END
END

GO

-- ===== sp_ActualizarNotificacionEnviada =====

CREATE OR ALTER PROCEDURE [app].[sp_ActualizarNotificacionEnviada]
    @IdPaso UNIQUEIDENTIFIER
AS
BEGIN
    UPDATE [app].[PasosFlujo]
    SET NotificacionEnviada = 1,
        FechaUltimaNotificacion = GETDATE()
    WHERE IdPaso = @IdPaso;
END

GO

-- ===== sp_AprobarDocumento =====

CREATE OR ALTER PROCEDURE [app].[sp_AprobarDocumento]
    @IdDocumento UNIQUEIDENTIFIER,
    @Usuario NVARCHAR(255),
    @Comentarios NVARCHAR(MAX) = NULL,
    @RutaArchivoFirmado NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdGrupo UNIQUEIDENTIFIER;
    DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;

    SELECT TOP 1
        @IdGrupo = IdGrupo,
        @IdDocumentoPrincipal = CASE WHEN EsPrincipal = 1 THEN IdDocumento ELSE NULL END
    FROM [app].[DocumentosConFlujo]
    WHERE IdDocumento = @IdDocumento;

    IF @IdGrupo IS NULL
    BEGIN
        RAISERROR('Documento no encontrado', 16, 1);
        RETURN;
    END

    IF @IdDocumentoPrincipal IS NULL
    BEGIN
        SELECT TOP 1 @IdDocumentoPrincipal = IdDocumento
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo
        ORDER BY CASE WHEN EsPrincipal = 1 THEN 0 ELSE 1 END, FechaSubida;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Verificar que es el turno del usuario
        DECLARE @MiOrden INT;
        SELECT @MiOrden = Orden
        FROM [app].[PasosFlujo]
        WHERE IdDocumento = @IdDocumentoPrincipal
            AND UsuarioAprobador = @Usuario
            AND Estatus = 'Pendiente';

        IF @MiOrden IS NULL
        BEGIN
            RAISERROR('No tienes un paso pendiente en este documento', 16, 1);
            RETURN;
        END

        -- Verificar que no hay pasos anteriores pendientes
        IF EXISTS (
            SELECT 1 FROM [app].[PasosFlujo]
            WHERE IdDocumento = @IdDocumentoPrincipal
                AND Orden < @MiOrden
                AND Estatus = 'Pendiente'
        )
        BEGIN
            RAISERROR('Aún hay pasos anteriores pendientes', 16, 1);
            RETURN;
        END

        -- Aprobar el paso
        UPDATE [app].[PasosFlujo]
        SET Estatus = 'Aprobado',
            FechaAccion = GETDATE(),
            Comentarios = @Comentarios
        WHERE IdDocumento = @IdDocumentoPrincipal
            AND UsuarioAprobador = @Usuario
            AND Estatus = 'Pendiente';

        -- Actualizar documento
        UPDATE [app].[DocumentosConFlujo]
        SET RutaArchivoFirmado = @RutaArchivoFirmado,
            FechaUltimaAccion = GETDATE(),
            FechaUltimaAtencion = GETDATE()
        WHERE IdDocumento = @IdDocumentoPrincipal;

        -- Verificar si se completó el flujo
        IF NOT EXISTS (
            SELECT 1 FROM [app].[PasosFlujo]
            WHERE IdDocumento = @IdDocumentoPrincipal
                AND Estatus = 'Pendiente'
        )
        BEGIN
            UPDATE [app].[DocumentosConFlujo]
            SET EstatusFlujo = 'Completado',
                FechaCompletado = GETDATE(),
                FechaUltimaAtencion = GETDATE()
            WHERE IdGrupo = @IdGrupo;
        END
        ELSE
        BEGIN
            UPDATE [app].[DocumentosConFlujo]
            SET FechaUltimaAccion = GETDATE(),
                FechaUltimaAtencion = GETDATE()
            WHERE IdGrupo = @IdGrupo;
        END

        COMMIT TRANSACTION;

        INSERT INTO [app].[DocumentosHistorial](IdDocumento, Accion, Usuario, FechaAccion, Detalle)
        SELECT IdDocumento, 'FIRMA', @Usuario, GETDATE(), ISNULL(@Comentarios, '')
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo;

        -- Retornar siguiente usuario (si existe)
        SELECT TOP 1
            UsuarioAprobador AS SiguienteUsuario,
            Orden AS SiguienteOrden
        FROM [app].[PasosFlujo]
        WHERE IdDocumento = @IdDocumentoPrincipal
            AND Estatus = 'Pendiente'
        ORDER BY Orden;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END

GO

-- ===== sp_CrearDocumentoConFlujo =====

CREATE OR ALTER PROCEDURE [app].[sp_CrearDocumentoConFlujo]
    @IdDocumento UNIQUEIDENTIFIER,
    @NombreArchivo NVARCHAR(255),
    @RutaArchivoInicial NVARCHAR(500),
    @CreadoPor NVARCHAR(255),
    @ComentarioInicial NVARCHAR(MAX),
    @TamanoBytes BIGINT,
    @HashSHA256 NVARCHAR(64),
    @Aprobadores NVARCHAR(MAX) -- XML: <Pasos><Paso Orden="1" Usuario="user@dom" Identificador="firma_1"/></Pasos>
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Insertar documento
        INSERT INTO [app].[DocumentosConFlujo] (
            IdDocumento, NombreArchivo, RutaArchivoInicial, CreadoPor,
            ComentarioInicial, TamanoBytes, HashSHA256, FechaUltimaAccion, FechaUltimaAtencion, FechaSubida
        )
        VALUES (
            @IdDocumento, @NombreArchivo, @RutaArchivoInicial, @CreadoPor,
            @ComentarioInicial, @TamanoBytes, @HashSHA256, GETDATE(), GETDATE(), GETDATE()
        );

        -- Parsear XML de aprobadores
        DECLARE @xml XML = CAST(@Aprobadores AS XML);

        -- Insertar pasos del flujo
        INSERT INTO [app].[PasosFlujo] (IdDocumento, Orden, UsuarioAprobador, IdentificadorFirma)
        SELECT
            @IdDocumento,
            T.c.value('@Orden', 'int'),
            T.c.value('@Usuario', 'nvarchar(255)'),
            T.c.value('@Identificador', 'nvarchar(100)')
        FROM @xml.nodes('/Pasos/Paso') T(c);

        INSERT INTO [app].[DocumentosHistorial](IdDocumento, Accion, Usuario, FechaAccion, Detalle)
        VALUES (@IdDocumento, 'SUBIDA', @CreadoPor, GETDATE(), @ComentarioInicial);

        COMMIT TRANSACTION;

        SELECT @IdDocumento AS IdDocumento;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END

GO

-- ===== sp_CrearGrupoDocumentosConFlujo =====

CREATE OR ALTER PROCEDURE [app].[sp_CrearGrupoDocumentosConFlujo]
    @IdGrupo UNIQUEIDENTIFIER,
    @CreadoPor NVARCHAR(255),
    @ComentarioInicial NVARCHAR(MAX),
    @Documentos NVARCHAR(MAX), -- JSON: [{IdDocumento, NombreArchivo, RutaArchivoInicial, TipoDocumento, TamanoBytes, HashSHA256}]
    @Aprobadores NVARCHAR(MAX) -- XML: <Pasos><Paso Orden="1" Usuario="user@dom" Identificador="firma_1"/></Pasos>
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Tbl temporal para capturar documentos insertados
        DECLARE @DocumentosInsertados TABLE (IdDocumento UNIQUEIDENTIFIER, TipoDocumento NVARCHAR(50));

        -- Crear el grupo
        INSERT INTO [app].[GruposDocumentos] (
            IdGrupo, CreadoPor, ComentarioInicial, FechaUltimaAccion
        )
        VALUES (
            @IdGrupo, @CreadoPor, @ComentarioInicial, GETDATE()
        );

        -- Insertar documentos del grupo desde JSON
        INSERT INTO [app].[DocumentosConFlujo] (
            IdDocumento, IdGrupo, NombreArchivo, RutaArchivoInicial, TipoDocumento,
            CreadoPor, ComentarioInicial, TamanoBytes, HashSHA256,
            FechaUltimaAccion, FechaUltimaAtencion, FechaSubida
        ) OUTPUT inserted.IdDocumento, inserted.TipoDocumento INTO @DocumentosInsertados
        SELECT
            IdDocumento,
            @IdGrupo,
            NombreArchivo,
            RutaArchivoInicial,
            TipoDocumento,
            @CreadoPor,
            @ComentarioInicial,
            TamanoBytes,
            HashSHA256,
            GETDATE(),
            GETDATE(),
            GETDATE()
        FROM OPENJSON(@Documentos)
        WITH (
            IdDocumento UNIQUEIDENTIFIER '$.IdDocumento',
            NombreArchivo NVARCHAR(255) '$.NombreArchivo',
            RutaArchivoInicial NVARCHAR(500) '$.RutaArchivoInicial',
            TipoDocumento NVARCHAR(50) '$.TipoDocumento',
            TamanoBytes BIGINT '$.TamanoBytes',
            HashSHA256 NVARCHAR(64) '$.HashSHA256'
        );

        -- Definir documento principal (representante del flujo)
        DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;
        SELECT TOP 1 @IdDocumentoPrincipal = d.IdDocumento
        FROM @DocumentosInsertados di
        INNER JOIN [app].[DocumentosConFlujo] d ON d.IdDocumento = di.IdDocumento
        WHERE d.TipoDocumento = 'Principal'
        ORDER BY d.FechaSubida;

        IF @IdDocumentoPrincipal IS NULL
        BEGIN
            RAISERROR('Debe haber al menos un documento Principal', 16, 1);
        END

        -- Marcar documento representante
        UPDATE [app].[DocumentosConFlujo]
        SET EsPrincipal = CASE WHEN IdDocumento = @IdDocumentoPrincipal THEN 1 ELSE 0 END
        WHERE IdGrupo = @IdGrupo;

        -- Parsear XML de aprobadores
        DECLARE @xml XML = CAST(@Aprobadores AS XML);

        -- Insertar pasos del flujo (amarrados al documento principal del grupo)
        INSERT INTO [app].[PasosFlujo] (IdGrupo, IdDocumento, Orden, UsuarioAprobador, IdentificadorFirma)
        SELECT
            @IdGrupo,
            @IdDocumentoPrincipal,
            T.c.value('@Orden', 'int'),
            T.c.value('@Usuario', 'nvarchar(255)'),
            T.c.value('@Identificador', 'nvarchar(100)')
        FROM @xml.nodes('/Pasos/Paso') T(c);

        -- Registrar en historial
        INSERT INTO [app].[DocumentosHistorial](IdDocumento, Accion, Usuario, FechaAccion, Detalle)
        SELECT IdDocumento, 'SUBIDA', @CreadoPor, GETDATE(), @ComentarioInicial
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo;

        COMMIT TRANSACTION;

        SELECT @IdGrupo AS IdGrupo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END

GO

-- ===== sp_CrearUsuarioAnonimo =====

CREATE OR ALTER PROCEDURE app.sp_CrearUsuarioAnonimo
    @NombreCompleto NVARCHAR(512),
    @Correo NVARCHAR(512)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdUsuario INT;

    -- Verificar si ya existe un usuario anónimo con ese correo
    SELECT @IdUsuario = IdUsuario
    FROM app.Usuarios
    WHERE Correo = @Correo AND EsAnonimo = 1;

    IF @IdUsuario IS NULL
    BEGIN
        -- Crear nuevo usuario anónimo
        INSERT INTO app.Usuarios (
            SamAccountName,
            Dominio,
            NombreCompleto,
            Correo,
            EsAnonimo,
            EsActivo,
            EsRobot,
            FechaCreacion,
            UltimoLogin
        )
        VALUES (
            NULL,
            NULL,
            @NombreCompleto,
            @Correo,
            1, -- Es anónimo
            1, -- Activo
            0, -- No es robot
            GETUTCDATE(),
            GETUTCDATE()
        );

        SET @IdUsuario = SCOPE_IDENTITY();

        -- Asignar rol "Anónimo" (IdRol = 6) por defecto
        INSERT INTO app.UsuariosRoles (IdUsuario, IdRol)
        VALUES (@IdUsuario, 6);
    END
    ELSE
    BEGIN
        -- Actualizar última conexión
        UPDATE app.Usuarios
        SET UltimoLogin = GETUTCDATE()
        WHERE IdUsuario = @IdUsuario;
    END

    -- Retornar información del usuario
    SELECT
        u.IdUsuario,
        u.SamAccountName,
        u.Dominio,
        u.NombreCompleto,
        u.Correo,
        0 AS IdNomina,
        u.EsAnonimo,
        u.EsActivo,
        u.EsRobot
    FROM app.Usuarios u
    WHERE u.IdUsuario = @IdUsuario;
END

GO

-- ===== sp_DocumentosBandejaUsuarios =====
CREATE OR ALTER PROCEDURE [app].[sp_DocumentosBandejaUsuarios]
    @SamAccountName NVARCHAR(128) = NULL,
    @IncludeAll BIT = 0,
    @NameIdentifier NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Dominio NVARCHAR(128);
    DECLARE @Usuario NVARCHAR(128);
    DECLARE @AtPos INT;


    -- 1. Manejar el caso NULL primero
    IF @SamAccountName IS NULL
    BEGIN
        SET @Usuario = NULL;
        SET @Dominio = NULL;
    END
    ELSE
    BEGIN
        -- 2. Encontrar la posición del '@'
        SET @AtPos = CHARINDEX('@', @SamAccountName);

        IF @AtPos > 0 -- Si se encontró el '@'
        BEGIN
            -- El usuario es la subcadena antes del '@'
            SET @Usuario = LEFT(@SamAccountName, @AtPos - 1);
        
            -- El dominio es la subcadena después del '@'
            SET @Dominio = SUBSTRING(@SamAccountName, @AtPos + 1, LEN(@SamAccountName));
        END
        ELSE -- Si NO se encontró el '@' (solo es el usuario)
        BEGIN
            SET @Usuario = @SamAccountName;
            SET @Dominio = NULL; -- O la cadena de dominio por defecto que necesites
        END
    END
    set @SamAccountName = @Usuario
    if(@SamAccountName = 'a') 
        begin
        set @SamAccountName = Null
        set  @IncludeAll = 1
        end
    else
    begin 
        set  @IncludeAll = 0
    end 

    IF @NameIdentifier IS NOT NULL 
    BEGIN 
        SET @AtPos = CHARINDEX('@', @NameIdentifier);

        IF @AtPos > 0 -- Si se encontró el '@'
        BEGIN
           select top 1 @Dominio = Dominio,@Usuario = SamAccountName from app.Usuarios where Correo = @NameIdentifier
            set @SamAccountName = @Usuario
            if(@SamAccountName = 'a') 
                begin
                set @SamAccountName = Null
                set  @IncludeAll = 1
                end
            else
            begin 
                set  @IncludeAll = 0
            end 
        END
    END 

    
    -- Resultado para verificar
    --SELECT 
    --    SamAccountName = @SamAccountName,
    --    Usuario = @Usuario, 
    --    Dominio = @Dominio;



    DECLARE @Results TABLE (
        SamAccountName NVARCHAR(128),
        Dominio NVARCHAR(256),
        NombreCompleto NVARCHAR(256),
        IdUsuario INT
    );

    IF @IncludeAll = 1
    BEGIN
        -- Usamos un CTE con ROW_NUMBER() para obtener el registro único
        -- por SamAccountName y Dominio, priorizando el IdUsuario más reciente.
        ;WITH UsuariosUnicos AS (
            SELECT
                SamAccountName = TRIM(u.SamAccountName),
                Dominio = TRIM(u.Dominio),
                NombreCompleto = COALESCE(NULLIF(u.NombreCompleto, ''), TRIM(u.SamAccountName)),
                IdUsuario = u.IdUsuario,
                -- 1. Particionamos (agrupamos) por la combinación que debe ser única.
                -- 2. Ordenamos para decidir qué fila priorizar (la del IdUsuario más alto).
                RowNum = ROW_NUMBER() OVER (
                    PARTITION BY TRIM(u.SamAccountName), TRIM(u.Dominio) 
                    ORDER BY u.IdUsuario DESC
                )
            FROM app.Usuarios u WITH (NOLOCK)
            WHERE u.SamAccountName IS NOT NULL
              AND TRIM(u.SamAccountName) <> '' --and u.Dominio =  @Dominio
        )
        -- 3. Insertamos solo las filas que marcamos como "1" (la principal de cada grupo)
        INSERT INTO @Results (SamAccountName, Dominio, NombreCompleto, IdUsuario)
        SELECT
            SamAccountName,
            Dominio,
            NombreCompleto,
            IdUsuario
        FROM UsuariosUnicos
        WHERE RowNum = 1;
    END
    ELSE
    BEGIN
        -- Esta lógica ya selecciona el IdUsuario más reciente para un usuario específico,
        -- lo cual es consistente con el CTE de arriba.
        INSERT INTO @Results (SamAccountName, Dominio, NombreCompleto, IdUsuario)
        SELECT TOP 1
            SamAccountName = COALESCE(NULLIF(TRIM(u.SamAccountName), ''), TRIM(@SamAccountName)),
            Dominio = TRIM(u.Dominio),
            NombreCompleto = COALESCE(NULLIF(u.NombreCompleto, ''), COALESCE(TRIM(@SamAccountName), '')),
            IdUsuario = u.IdUsuario
        FROM app.Usuarios u WITH (NOLOCK)
        WHERE TRIM(u.SamAccountName) = TRIM(@SamAccountName) and u.Dominio =  @Dominio
        ORDER BY u.IdUsuario DESC;

        -- Fallback si el usuario no existe en la tabla
        IF NOT EXISTS (SELECT 1 FROM @Results) AND @SamAccountName IS NOT NULL
        BEGIN
            INSERT INTO @Results (SamAccountName, Dominio, NombreCompleto, IdUsuario)
            VALUES (TRIM(@SamAccountName), NULL, TRIM(@SamAccountName), NULL);
        END
    END

    -- Select final de los resultados
    SELECT
        SamAccountName,
        Dominio,
        NombreCompleto,
        IdUsuario
    FROM @Results
    ORDER BY NombreCompleto, SamAccountName;
END;

GO

-- ===== sp_DocumentosDashboardSeries =====

CREATE OR ALTER PROCEDURE [app].[sp_DocumentosDashboardSeries]
    @SamAccountName NVARCHAR(128) = NULL,
    @DaysBack INT = 90,
    @NameIdentifier NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    if(@SamAccountName = 'a@Grupolefarma' ) 
        begin
        set @SamAccountName = Null
        end
    else

    DECLARE @Dominio NVARCHAR(128);
    DECLARE @Usuario NVARCHAR(128);
    DECLARE @AtPos INT;

    -- 1. Manejar el caso NULL primero
    IF @SamAccountName IS NULL
    BEGIN
        SET @Usuario = NULL;
        SET @Dominio = NULL;
    END
    ELSE
    BEGIN
        -- 2. Encontrar la posición del '@'
        SET @AtPos = CHARINDEX('@', @SamAccountName);

        IF @AtPos > 0 -- Si se encontró el '@'
        BEGIN
            -- El usuario es la subcadena antes del '@'
            SET @Usuario = LEFT(@SamAccountName, @AtPos - 1);
        
            -- El dominio es la subcadena después del '@'
            SET @Dominio = SUBSTRING(@SamAccountName, @AtPos + 1, LEN(@SamAccountName));
        END
        ELSE -- Si NO se encontró el '@' (solo es el usuario)
        BEGIN
            SET @Usuario = @SamAccountName;
            SET @Dominio = NULL; -- O la cadena de dominio por defecto que necesites
        END
    END
    set @SamAccountName = @Usuario


    IF @NameIdentifier IS NOT NULL and (@Usuario is null or @Usuario <> '')
    BEGIN 
        SET @AtPos = CHARINDEX('@', @SamAccountName);

        IF @AtPos > 0 -- Si se encontró el '@'
        BEGIN
           select top 1 @Dominio = Dominio,@Usuario = SamAccountName from app.Usuarios where Correo = @NameIdentifier
            set @SamAccountName = @Usuario
            if(@SamAccountName = 'a') 
                begin
                set @SamAccountName = Null
                end
            else
            begin 
                set @SamAccountName = @Usuario +'@'+ @Dominio
            end 
        END
    END 






    IF (@DaysBack IS NULL OR @DaysBack < 1)
        SET @DaysBack = 90;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    DECLARE @StartDate DATE = DATEADD(DAY, -(@DaysBack - 1), @Today);

    ;WITH DateSeries AS (
        SELECT @StartDate AS Fecha
        UNION ALL
        SELECT DATEADD(DAY, 1, Fecha)
        FROM DateSeries
        WHERE Fecha < @Today
    )
    SELECT
        Fecha,
        Uploaded = (
            SELECT COUNT(*)
            FROM app.Documentos d WITH (NOLOCK)
            WHERE d.Activo = 1
              AND CAST(d.FechaSubida AS DATE) = Fecha
              AND (
                    @SamAccountName IS NULL
                    OR d.SubidoPorUsuario = @SamAccountName
                    OR d.AutorizadoPorUsuario = @SamAccountName
                    OR d.RechazadoPorUsuario = @SamAccountName
              )
        ),
        Authorized = (
            SELECT COUNT(*)
            FROM app.Documentos d WITH (NOLOCK)
            WHERE d.Activo = 1
              AND d.Estatus = 2
              AND d.FechaAutorizacion IS NOT NULL
              AND CAST(d.FechaAutorizacion AS DATE) = Fecha
              AND (
                    @SamAccountName IS NULL
                    OR d.SubidoPorUsuario = @SamAccountName
                    OR d.AutorizadoPorUsuario = @SamAccountName
                    OR d.RechazadoPorUsuario = @SamAccountName
              )
        ),
        Rejected = (
            SELECT COUNT(*)
            FROM app.Documentos d WITH (NOLOCK)
            WHERE d.Activo = 1
              AND d.Estatus = 3
              AND d.FechaRechazo IS NOT NULL
              AND CAST(d.FechaRechazo AS DATE) = Fecha
              AND (
                    @SamAccountName IS NULL
                    OR d.SubidoPorUsuario = @SamAccountName
                    OR d.AutorizadoPorUsuario = @SamAccountName
                    OR d.RechazadoPorUsuario = @SamAccountName
              )
        )
    FROM DateSeries
    OPTION (MAXRECURSION 0);
END;

GO

-- ===== sp_DocumentosDashboardStatistics =====
--exec app.sp_DocumentosDashboardStatistics @SamAccountName = '2@Grupolefarma', @NameIdentifier = '2@grupolefarma.com.mx'
CREATE OR ALTER PROCEDURE [app].[sp_DocumentosDashboardStatistics]
    @SamAccountName NVARCHAR(128) = NULL,
    @NameIdentifier NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    if(@SamAccountName = 'a@Grupolefarma' ) set @SamAccountName = Null
    
    DECLARE @Dominio NVARCHAR(128);
    DECLARE @Usuario NVARCHAR(128);
    DECLARE @AtPos INT;
    IF @NameIdentifier IS NOT NULL and (@Usuario is null or @Usuario <> '')
    BEGIN 
        SET @AtPos = CHARINDEX('@', @SamAccountName);

        IF @AtPos > 0 -- Si se encontró el '@'
        BEGIN
           select top 1 @Dominio = Dominio,@Usuario = SamAccountName from app.Usuarios where Correo = @NameIdentifier
            set @SamAccountName = @Usuario
            if(@SamAccountName = 'a') 
                begin
                set @SamAccountName = Null
                end
            else
            begin 
                set @SamAccountName = @Usuario +'@'+ @Dominio
            end 
        END
    END 

    print @SamAccountName
    DECLARE @TotalDocumentos INT = 0;
    DECLARE @PrimeraFecha DATE = NULL;
    DECLARE @UltimaFecha DATE = NULL;
    DECLARE @Dias INT = 0;
    DECLARE @Promedio DECIMAL(10, 2) = 0;

    SELECT
        @TotalDocumentos = COUNT(*),
        @PrimeraFecha = MIN(CAST(FechaSubida AS DATE)),
        @UltimaFecha = MAX(CAST(FechaSubida AS DATE))
    FROM app.Documentos WITH (NOLOCK)
    WHERE Activo = 1
      AND (
          @SamAccountName IS NULL
          OR SubidoPorUsuario = @SamAccountName
          OR AutorizadoPorUsuario = @SamAccountName
          OR RechazadoPorUsuario = @SamAccountName
      );

    IF @PrimeraFecha IS NOT NULL
    BEGIN
        SET @Dias = DATEDIFF(DAY, @PrimeraFecha, @UltimaFecha) + 1;
        IF @Dias <= 0
            SET @Dias = 1;
    END

    IF @Dias > 0 AND @TotalDocumentos > 0
    BEGIN
        SET @Promedio = ROUND(CAST(@TotalDocumentos AS DECIMAL(10, 4)) / @Dias, 2);
    END

    SET @TotalDocumentos = ISNULL(@TotalDocumentos, 0);
    SET @Promedio = ISNULL(@Promedio, 0);

    SELECT
        DocumentsPendingAuthorization = COALESCE(SUM(CASE WHEN Estatus = 1 THEN 1 ELSE 0 END), 0),
        DocumentsAuthorized = COALESCE(SUM(CASE WHEN Estatus = 2 THEN 1 ELSE 0 END), 0),
        AverageDocumentsPerDay = @Promedio
    FROM app.Documentos WITH (NOLOCK)
    WHERE Activo = 1
      AND (
          @SamAccountName IS NULL
          OR SubidoPorUsuario = @SamAccountName
          OR AutorizadoPorUsuario = @SamAccountName
          OR RechazadoPorUsuario = @SamAccountName
      );
END;

select top 1  * from app.Documentos

select top 1 * from app.usuarios 
GO

-- ===== sp_DocumentosDashboardUserStats =====
--exec [app].[sp_DocumentosDashboardUserStats] @SamAccountName = '' ,@IncludeAll = 0,@NameIdentifier = 'a@grupolefarma.com'
CREATE OR ALTER PROCEDURE [app].[sp_DocumentosDashboardUserStats]
    @SamAccountName NVARCHAR(128) = NULL,
    @IncludeAll INT = 0,
    @NameIdentifier NVARCHAR(128) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Dominio NVARCHAR(128);
    DECLARE @Usuario NVARCHAR(128);
    DECLARE @AtPos INT;
    
    DECLARE @FullUserKey NVARCHAR(128) = @SamAccountName; 

    IF @SamAccountName IS NOT NULL
    BEGIN
        SET @AtPos = CHARINDEX('@', @SamAccountName);
   
        IF @AtPos > 0
        BEGIN
            SET @Usuario = LEFT(@SamAccountName, @AtPos - 1);
            SET @Dominio = SUBSTRING(@SamAccountName, @AtPos + 1, LEN(@SamAccountName));
        END
        ELSE
        BEGIN
            SET @Usuario = @SamAccountName;
            SET @Dominio = NULL;
        END
        
        IF @Usuario = 'a'
        BEGIN
            SET @IncludeAll = 1;
        END
    END

    IF @NameIdentifier IS NOT NULL 
    BEGIN 
        SET @AtPos = CHARINDEX('@', @NameIdentifier);
             print(@AtPos)
        IF @AtPos > 0 -- Si se encontró el '@'
        BEGIN
           select top 1 @Dominio = Dominio,@Usuario = SamAccountName from app.Usuarios where Correo = @NameIdentifier
            set @SamAccountName = @Usuario
            if(@SamAccountName = 'a') 
                begin
                set @SamAccountName = Null
                set  @IncludeAll = 1
                end
            else
            begin 
                set  @IncludeAll = 0
            end 
        END
    END 



    
    IF @IncludeAll = 1
    BEGIN
        SET @FullUserKey = NULL;
    END

    DECLARE @FechaInicioMes DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
    DECLARE @FechaFinMes DATE = EOMONTH(GETDATE());
    DECLARE @FechaFinMesSiguiente DATE = DATEADD(DAY, 1, @FechaFinMes); 

    DECLARE @Results TABLE (
        SamAccountName NVARCHAR(128),
        UserName NVARCHAR(256),
        AuthorizedThisMonth INT,
        RejectedThisMonth INT,
        PendingThisMonth INT
    );

    IF @IncludeAll = 1
    BEGIN
        -- ========= INICIO: Bloque para TODOS los usuarios (@IncludeAll = 1) =========
        
        -- CORRECCIÓN: El WITH va ANTES del INSERT.
        ;WITH 
        DocumentCounts AS (
            SELECT
                UserKey = CAST(SubidoPorUsuario AS NVARCHAR(128)),
                AuthorizedThisMonth = SUM(CASE WHEN FechaAutorizacion >= @FechaInicioMes AND FechaAutorizacion < @FechaFinMesSiguiente THEN 1 ELSE 0 END),
                RejectedThisMonth = SUM(CASE WHEN FechaRechazo >= @FechaInicioMes AND FechaRechazo < @FechaFinMesSiguiente THEN 1 ELSE 0 END),
                PendingThisMonth = SUM(CASE WHEN FechaRechazo IS NULL AND FechaAutorizacion IS NULL AND (FechaSubida >= @FechaInicioMes AND FechaSubida < @FechaFinMesSiguiente) THEN 1 ELSE 0 END)
            FROM app.Documentos WITH (NOLOCK)
            WHERE 
                Activo = 1
                AND SubidoPorUsuario IS NOT NULL
            GROUP BY CAST(SubidoPorUsuario AS NVARCHAR(128))
        ),
        UltimoUsuarioInfo AS (
            SELECT
                UserKey = SamAccountName + '@' + Dominio,
                NombreCompleto,
                rn = ROW_NUMBER() OVER (PARTITION BY SamAccountName, Dominio ORDER BY IdUsuario DESC)
            FROM app.Usuarios WITH (NOLOCK)
            WHERE 1 = 1
        )
        -- El INSERT va DESPUÉS de los CTEs
        INSERT INTO @Results (SamAccountName, UserName, AuthorizedThisMonth, RejectedThisMonth, PendingThisMonth)
        SELECT
            SamAccountName = ui.UserKey,
            UserName = COALESCE(NULLIF(ui.NombreCompleto, ''), ui.UserKey),
            AuthorizedThisMonth = ISNULL(dc.AuthorizedThisMonth, 0),
            RejectedThisMonth = ISNULL(dc.RejectedThisMonth, 0),
            PendingThisMonth = ISNULL(dc.PendingThisMonth, 0)
        FROM 
            UltimoUsuarioInfo ui
        LEFT JOIN 
            DocumentCounts dc ON ui.UserKey = dc.UserKey
        WHERE
            ui.rn = 1
            AND ui.UserKey IS NOT NULL AND LTRIM(RTRIM(ui.UserKey)) <> ''
            AND (
                ISNULL(dc.PendingThisMonth, 0) > 0
            );
            
        -- ========= FIN: Bloque para TODOS los usuarios =========
    END
    ELSE
    BEGIN
        -- ========= INICIO: Bloque para UN usuario específico (@IncludeAll = 0) =========

        -- CORRECCIÓN: El WITH va ANTES del INSERT.
        ;WITH 
        DocumentCounts AS (
            SELECT
                UserKey = CAST(SubidoPorUsuario AS NVARCHAR(128)),
                AuthorizedThisMonth = SUM(CASE WHEN FechaAutorizacion >= @FechaInicioMes AND FechaAutorizacion < @FechaFinMesSiguiente THEN 1 ELSE 0 END),
                RejectedThisMonth = SUM(CASE WHEN FechaRechazo >= @FechaInicioMes AND FechaRechazo < @FechaFinMesSiguiente THEN 1 ELSE 0 END),
                PendingThisMonth = SUM(CASE WHEN FechaRechazo IS NULL AND FechaAutorizacion IS NULL AND (FechaSubida >= @FechaInicioMes AND FechaSubida < @FechaFinMesSiguiente) THEN 1 ELSE 0 END)
            FROM app.Documentos WITH (NOLOCK)
            WHERE 
                Activo = 1
                AND SubidoPorUsuario IS NOT NULL
                AND (SubidoPorUsuario = @FullUserKey)
            GROUP BY CAST(SubidoPorUsuario AS NVARCHAR(128))
        ),
        UltimoUsuarioInfo AS (
            SELECT
                UserKey = SamAccountName + '@' + Dominio,
                NombreCompleto,
                rn = ROW_NUMBER() OVER (PARTITION BY SamAccountName, Dominio ORDER BY IdUsuario DESC)
            FROM app.Usuarios WITH (NOLOCK)
            WHERE 
                (SamAccountName + '@' + Dominio) = @FullUserKey
        )
        -- El INSERT va DESPUÉS de los CTEs
        INSERT INTO @Results (SamAccountName, UserName, AuthorizedThisMonth, RejectedThisMonth, PendingThisMonth)
        SELECT
            SamAccountName = ui.UserKey,
            UserName = COALESCE(NULLIF(ui.NombreCompleto, ''), ui.UserKey),
            AuthorizedThisMonth = ISNULL(dc.AuthorizedThisMonth, 0),
            RejectedThisMonth = ISNULL(dc.RejectedThisMonth, 0),
            PendingThisMonth = ISNULL(dc.PendingThisMonth, 0)
        FROM 
            UltimoUsuarioInfo ui
        LEFT JOIN 
            DocumentCounts dc ON ui.UserKey = dc.UserKey
        WHERE
            ui.rn = 1
            AND ui.UserKey IS NOT NULL AND LTRIM(RTRIM(ui.UserKey)) <> ''
            AND (ui.UserKey = @FullUserKey)
            AND (
                ISNULL(dc.PendingThisMonth, 0) > 0
            );

        -- ========= FIN: Bloque para UN usuario =========
    END

    -- 4. Select final de los resultados (ya sea de la rama IF o ELSE)
    SELECT
        SamAccountName,
        UserName,
        AuthorizedThisMonth,
        RejectedThisMonth,
        PendingThisMonth
    FROM @Results
    ORDER BY 
        AuthorizedThisMonth DESC,
        PendingThisMonth DESC,
        RejectedThisMonth DESC,
        UserName;

END;
GO

-- ===== sp_EliminarDocumentoSinFirmas =====

CREATE OR ALTER PROCEDURE [app].[sp_EliminarDocumentoSinFirmas]
    @IdDocumento UNIQUEIDENTIFIER,
    @Usuario NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdGrupo UNIQUEIDENTIFIER;
    DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;

    SELECT TOP 1
        @IdGrupo = IdGrupo,
        @IdDocumentoPrincipal = CASE WHEN EsPrincipal = 1 THEN IdDocumento ELSE NULL END
    FROM [app].[DocumentosConFlujo]
    WHERE IdDocumento = @IdDocumento
        AND CreadoPor = @Usuario
        AND Activo = 1;

    IF @IdGrupo IS NULL
    BEGIN
        RAISERROR('No puedes eliminar este documento', 16, 1);
        RETURN;
    END

    IF @IdDocumentoPrincipal IS NULL
    BEGIN
        SELECT TOP 1 @IdDocumentoPrincipal = IdDocumento
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo
        ORDER BY CASE WHEN EsPrincipal = 1 THEN 0 ELSE 1 END, FechaSubida;
    END

    -- Validar que no existan pasos con firmas (Aprobado/Rechazado)
    IF EXISTS (
        SELECT 1 FROM [app].[PasosFlujo]
        WHERE IdDocumento = @IdDocumentoPrincipal
          AND Estatus <> 'Pendiente'
    )
    BEGIN
        RAISERROR('El documento ya tiene firmas o acciones registradas', 16, 1);
        RETURN;
    END

    INSERT INTO [app].[DocumentosHistorial](IdDocumento, Accion, Usuario, FechaAccion, Detalle)
    SELECT IdDocumento, 'ELIMINACION', @Usuario, GETDATE(), 'Eliminación por creador sin firmas'
    FROM [app].[DocumentosConFlujo]
    WHERE IdGrupo = @IdGrupo;

    -- Eliminar todo el grupo (cascada elimina documentos y pasos)
    DELETE FROM [app].[GruposDocumentos]
    WHERE IdGrupo = @IdGrupo;
END

GO

-- ===== sp_ObtenerDocumentosFirmadosPorMi =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerDocumentosFirmadosPorMi]
    @Usuario NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT
        d.IdDocumento,
        d.NombreArchivo,
        d.FechaCreacion,
        d.EstatusFlujo,
        d.ComentarioInicial,
        d.CreadoPor,
        ISNULL(uc.NombreCompleto, d.CreadoPor) AS NombreCreadoPor,
        d.FechaUltimaAtencion AS FechaUltimaInteraccion,
        pmax.FechaAccion AS MiFechaFirma,
        pmax.Comentarios AS MisComentarios,
        tot.TotalPasos,
        tot.PasosCompletados,
        tot.PasoActual,
        (SELECT TOP 1 UsuarioAprobador
         FROM [app].[PasosFlujo]
         WHERE IdDocumento = d.IdDocumento AND Estatus = 'Pendiente'
         ORDER BY Orden) AS PasoActualUsuario,
        ISNULL((SELECT TOP 1 u.NombreCompleto
         FROM [app].[PasosFlujo] pf
         INNER JOIN [app].[Usuarios] u ON pf.UsuarioAprobador = u.SamAccountName + '@' + u.Dominio
         WHERE pf.IdDocumento = d.IdDocumento AND pf.Estatus = 'Pendiente'
         ORDER BY pf.Orden), '') AS NombrePasoActual,
        d.IdGrupo,
        (
            SELECT
                dc.IdDocumento,
                dc.NombreArchivo,
                dc.RutaArchivoInicial,
                dc.RutaArchivoFirmado,
                dc.TipoDocumento,
                dc.EsPrincipal,
                dc.TamanoBytes,
                dc.HashSHA256
            FROM [app].[DocumentosConFlujo] dc
            WHERE dc.IdGrupo = d.IdGrupo
            ORDER BY CASE WHEN dc.EsPrincipal = 1 THEN 0 ELSE 1 END, dc.TipoDocumento, dc.FechaSubida
            FOR JSON PATH
        ) AS Documentos
    FROM [app].[DocumentosConFlujo] d
    LEFT JOIN [app].[Usuarios] uc ON d.CreadoPor = uc.SamAccountName + '@' + uc.Dominio
    CROSS APPLY (
        SELECT
            COUNT(*) AS TotalPasos,
            SUM(CASE WHEN pf.Estatus = 'Aprobado' THEN 1 ELSE 0 END) AS PasosCompletados,
            ISNULL(MIN(CASE WHEN pf.Estatus = 'Pendiente' THEN pf.Orden END), COUNT(*)) AS PasoActual
        FROM [app].[PasosFlujo] pf
        WHERE pf.IdDocumento = d.IdDocumento
    ) tot
    OUTER APPLY (
        SELECT TOP 1 FechaAccion, Comentarios
        FROM [app].[PasosFlujo]
        WHERE IdDocumento = d.IdDocumento
          AND UsuarioAprobador = @Usuario
          AND Estatus = 'Aprobado'
        ORDER BY FechaAccion DESC
    ) pmax
    WHERE d.EstatusFlujo = 'EnProgreso'
      AND d.Activo = 1
      AND d.EsPrincipal = 1
      AND (
            d.CreadoPor = @Usuario
         OR EXISTS (
            SELECT 1 FROM [app].[PasosFlujo] p
            WHERE p.IdDocumento = d.IdDocumento
              AND p.UsuarioAprobador = @Usuario
              AND p.Estatus = 'Aprobado'
         )
      )
    ORDER BY d.FechaCreacion DESC;
END

GO

-- ===== sp_ObtenerDocumentosPendientesFirmar =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerDocumentosPendientesFirmar]
    @Usuario NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.IdDocumento,
        d.NombreArchivo,
        d.FechaCreacion,
        d.EstatusFlujo,
        d.ComentarioInicial,
        d.CreadoPor,
        ISNULL(uc.NombreCompleto, d.CreadoPor) AS NombreCreadoPor,
        d.FechaUltimaAtencion AS FechaUltimaInteraccion,
        d.IdGrupo,
        p.Orden,
        p.IdentificadorFirma,
        p.FechaUltimaNotificacion,
        tot.TotalPasos,
        tot.PasosCompletados,
        tot.PasoActual,
        tot.UsuarioActual,
        ISNULL(ua.NombreCompleto, tot.UsuarioActual) AS NombreUsuarioActual,
        -- Calcular si debe estar en amarillo o rojo
        CASE
            WHEN DATEDIFF(DAY, ISNULL(p.FechaUltimaNotificacion, p.FechaAsignacion), GETDATE()) > 6 THEN 'rojo'
            WHEN DATEDIFF(DAY, ISNULL(p.FechaUltimaNotificacion, p.FechaAsignacion), GETDATE()) > 3 THEN 'amarillo'
            ELSE 'normal'
        END AS ColorAlerta,
        -- Verificar si soy el siguiente en firmar
        CASE
            WHEN p.Orden = (
                SELECT MIN(p2.Orden)
                FROM [app].[PasosFlujo] p2
                WHERE p2.IdDocumento = d.IdDocumento
                    AND p2.Estatus = 'Pendiente'
            ) THEN CAST(1 AS BIT)
            ELSE CAST(0 AS BIT)
        END AS EsMiTurno,
        (
            SELECT
                dc.IdDocumento,
                dc.NombreArchivo,
                dc.RutaArchivoInicial,
                dc.RutaArchivoFirmado,
                dc.TipoDocumento,
                dc.EsPrincipal,
                dc.TamanoBytes,
                dc.HashSHA256
            FROM [app].[DocumentosConFlujo] dc
            WHERE dc.IdGrupo = d.IdGrupo
            ORDER BY CASE WHEN dc.EsPrincipal = 1 THEN 0 ELSE 1 END, dc.TipoDocumento, dc.FechaSubida
            FOR JSON PATH
        ) AS Documentos
    FROM [app].[DocumentosConFlujo] d
    INNER JOIN [app].[PasosFlujo] p ON d.IdDocumento = p.IdDocumento
    LEFT JOIN [app].[Usuarios] uc ON d.CreadoPor = uc.SamAccountName + '@' + uc.Dominio
    CROSS APPLY (
        SELECT
            COUNT(*) AS TotalPasos,
            SUM(CASE WHEN pf.Estatus = 'Aprobado' THEN 1 ELSE 0 END) AS PasosCompletados,
            ISNULL(MIN(CASE WHEN pf.Estatus = 'Pendiente' THEN pf.Orden END), COUNT(*)) AS PasoActual,
            (SELECT TOP 1 UsuarioAprobador FROM [app].[PasosFlujo] WHERE IdDocumento = d.IdDocumento AND Estatus = 'Pendiente' ORDER BY Orden) AS UsuarioActual
        FROM [app].[PasosFlujo] pf
        WHERE pf.IdDocumento = d.IdDocumento
    ) tot
        LEFT JOIN [app].[Usuarios] ua ON tot.UsuarioActual = ua.SamAccountName + '@' + ua.Dominio
    WHERE p.UsuarioAprobador = @Usuario
        AND p.Estatus = 'Pendiente'
        AND d.EstatusFlujo = 'EnProgreso'
        AND d.Activo = 1
        AND d.EsPrincipal = 1
        -- Solo mostrar si es mi turno (primer paso pendiente)
        AND p.Orden = (
            SELECT MIN(p2.Orden)
            FROM [app].[PasosFlujo] p2
            WHERE p2.IdDocumento = d.IdDocumento
                AND p2.Estatus = 'Pendiente'
        )
    ORDER BY d.FechaCreacion DESC;
END

GO

-- ===== sp_ObtenerFirmaUsuario =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerFirmaUsuario]
    @SamAccountName NVARCHAR(255),
    @Dominio NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        CASE
            WHEN MetadataJson IS NOT NULL
                AND CHARINDEX('"tieneFirma":true', MetadataJson) > 0 THEN CAST(1 AS BIT)
            ELSE CAST(0 AS BIT)
        END AS TieneFirma,
        CASE
            WHEN MetadataJson IS NOT NULL
                AND CHARINDEX('"pathFirma":"', MetadataJson) > 0
            THEN SUBSTRING(
                MetadataJson,
                CHARINDEX('"pathFirma":"', MetadataJson) + 13,
                NULLIF(CHARINDEX('"', MetadataJson, CHARINDEX('"pathFirma":"', MetadataJson) + 13), 0) - (CHARINDEX('"pathFirma":"', MetadataJson) + 13)
            )
            ELSE NULL
        END AS PathFirma,
        CASE
            WHEN MetadataJson IS NOT NULL
                AND CHARINDEX('"identificadorFirma":"', MetadataJson) > 0
            THEN SUBSTRING(
                MetadataJson,
                CHARINDEX('"identificadorFirma":"', MetadataJson) + 22,
                NULLIF(CHARINDEX('"', MetadataJson, CHARINDEX('"identificadorFirma":"', MetadataJson) + 22), 0) - (CHARINDEX('"identificadorFirma":"', MetadataJson) + 22)
            )
            ELSE NULL
        END AS IdentificadorFirma
    FROM [app].[Usuarios]
    WHERE SamAccountName = @SamAccountName
      AND Dominio = @Dominio
      AND EsActivo = 1;
END

GO

-- ===== sp_ObtenerFlujoDocumento =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerFlujoDocumento]
    @IdDocumento UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdGrupo UNIQUEIDENTIFIER;
    DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;

    SELECT TOP 1
        @IdGrupo = IdGrupo,
        @IdDocumentoPrincipal = CASE WHEN EsPrincipal = 1 THEN IdDocumento ELSE NULL END
    FROM [app].[DocumentosConFlujo]
    WHERE IdDocumento = @IdDocumento;

    IF @IdGrupo IS NULL
    BEGIN
        RAISERROR('Documento no encontrado', 16, 1);
        RETURN;
    END

    IF @IdDocumentoPrincipal IS NULL
    BEGIN
        SELECT TOP 1 @IdDocumentoPrincipal = IdDocumento
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo
        ORDER BY CASE WHEN EsPrincipal = 1 THEN 0 ELSE 1 END, FechaSubida;
    END

    -- Información del documento
    SELECT
        d.IdDocumento,
        d.NombreArchivo,
        d.FechaCreacion,
        d.EstatusFlujo,
        d.ComentarioInicial,
        d.CreadoPor,
        d.FechaCompletado,
        d.IdGrupo,
        (
            SELECT
                dc.IdDocumento,
                dc.NombreArchivo,
                dc.RutaArchivoInicial,
                dc.RutaArchivoFirmado,
                dc.TipoDocumento,
                dc.EsPrincipal,
                dc.TamanoBytes,
                dc.HashSHA256
            FROM [app].[DocumentosConFlujo] dc
            WHERE dc.IdGrupo = d.IdGrupo
            ORDER BY CASE WHEN dc.EsPrincipal = 1 THEN 0 ELSE 1 END, dc.TipoDocumento, dc.FechaSubida
            FOR JSON PATH
        ) AS Documentos
    FROM [app].[DocumentosConFlujo] d
    WHERE d.IdDocumento = @IdDocumentoPrincipal;

    -- Pasos del flujo
    SELECT
        p.IdPaso,
        p.Orden,
        p.UsuarioAprobador,
        p.Estatus,
        p.FechaAsignacion,
        p.FechaAccion,
        p.Comentarios,
        p.IdentificadorFirma,
        -- Obtener nombre del usuario
        (SELECT NombreCompleto FROM [app].[Usuarios]
         WHERE SamAccountName + '@' + Dominio = p.UsuarioAprobador) AS NombreUsuario
    FROM [app].[PasosFlujo] p
    WHERE p.IdDocumento = @IdDocumentoPrincipal
    ORDER BY p.Orden;
END

GO

-- ===== sp_ObtenerHistorialComentarios =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerHistorialComentarios]
    @IdDocumento UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdGrupo UNIQUEIDENTIFIER;
    DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;

    SELECT TOP 1
        @IdGrupo = IdGrupo,
        @IdDocumentoPrincipal = CASE WHEN EsPrincipal = 1 THEN IdDocumento ELSE NULL END
    FROM [app].[DocumentosConFlujo]
    WHERE IdDocumento = @IdDocumento;

    IF @IdGrupo IS NULL
    BEGIN
        RAISERROR('Documento no encontrado', 16, 1);
        RETURN;
    END

    IF @IdDocumentoPrincipal IS NULL
    BEGIN
        SELECT TOP 1 @IdDocumentoPrincipal = IdDocumento
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo
        ORDER BY CASE WHEN EsPrincipal = 1 THEN 0 ELSE 1 END, FechaSubida;
    END

    -- Comentario inicial del documento (solicitud)
    SELECT
        d.FechaCreacion AS Fecha,
        d.CreadoPor AS Usuario,
        'Solicitud' AS Estatus,
        d.ComentarioInicial AS Comentario
    FROM [app].[DocumentosConFlujo] d
    WHERE d.IdDocumento = @IdDocumentoPrincipal
      AND ISNULL(d.ComentarioInicial, '') <> ''

    UNION ALL

    -- Comentarios de los pasos (aprobaciones y rechazos)
    SELECT
        ISNULL(p.FechaAccion, GETDATE()) AS Fecha,
        p.UsuarioAprobador AS Usuario,
        p.Estatus AS Estatus,
        ISNULL(p.Comentarios, '') AS Comentario
    FROM [app].[PasosFlujo] p
    WHERE p.IdDocumento = @IdDocumentoPrincipal
      AND p.Estatus IN ('Aprobado', 'Rechazado')
      AND ISNULL(p.Comentarios, '') <> ''

    ORDER BY Fecha ASC;
END

GO

-- ===== sp_ObtenerMisDocumentos =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerMisDocumentos]
    @Usuario NVARCHAR(255),
    @FechaDesde DATETIME = NULL,
    @FechaHasta DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.IdDocumento,
        d.NombreArchivo,
        d.FechaCreacion,
        d.EstatusFlujo,
        d.ComentarioInicial,
        d.CreadoPor,
        ISNULL(uc.NombreCompleto, d.CreadoPor) AS NombreCreadoPor,
        d.FechaCompletado,
        d.FechaUltimaAtencion AS FechaUltimaInteraccion,
        -- Contar total de pasos y completados
        (SELECT COUNT(*) FROM [app].[PasosFlujo] WHERE IdDocumento = d.IdDocumento) AS TotalPasos,
        (SELECT COUNT(*) FROM [app].[PasosFlujo] WHERE IdDocumento = d.IdDocumento AND Estatus = 'Aprobado') AS PasosCompletados,
        -- Paso actual
        (SELECT TOP 1 UsuarioAprobador
         FROM [app].[PasosFlujo]
         WHERE IdDocumento = d.IdDocumento AND Estatus = 'Pendiente'
         ORDER BY Orden) AS PasoActualUsuario,
        ISNULL((SELECT TOP 1 u.NombreCompleto
         FROM [app].[PasosFlujo] pf
         INNER JOIN [app].[Usuarios] u ON pf.UsuarioAprobador = u.SamAccountName + '@' + u.Dominio
         WHERE pf.IdDocumento = d.IdDocumento AND pf.Estatus = 'Pendiente'
         ORDER BY pf.Orden), '') AS NombrePasoActual,
        DATEDIFF(DAY, ISNULL(d.FechaUltimaAccion, d.FechaCreacion), GETDATE()) AS DiasSinFirmar,
        CASE
            WHEN DATEDIFF(DAY, ISNULL(d.FechaUltimaAccion, d.FechaCreacion), GETDATE()) > 6 THEN 'roja'
            WHEN DATEDIFF(DAY, ISNULL(d.FechaUltimaAccion, d.FechaCreacion), GETDATE()) > 3 THEN 'amarilla'
            ELSE 'ninguna'
        END AS AlertaColor,
        d.IdGrupo,
        (
            SELECT
                dc.IdDocumento,
                dc.NombreArchivo,
                dc.RutaArchivoInicial,
                dc.RutaArchivoFirmado,
                dc.TipoDocumento,
                dc.EsPrincipal,
                dc.TamanoBytes,
                dc.HashSHA256
            FROM [app].[DocumentosConFlujo] dc
            WHERE dc.IdGrupo = d.IdGrupo
            ORDER BY CASE WHEN dc.EsPrincipal = 1 THEN 0 ELSE 1 END, dc.TipoDocumento, dc.FechaSubida
            FOR JSON PATH
        ) AS Documentos
    FROM [app].[DocumentosConFlujo] d
    LEFT JOIN [app].[Usuarios] uc ON d.CreadoPor = uc.SamAccountName + '@' + uc.Dominio
    WHERE d.CreadoPor = @Usuario
        AND d.Activo = 1
        AND d.EsPrincipal = 1
        AND (@FechaDesde IS NULL OR d.FechaCreacion >= @FechaDesde)
        AND (@FechaHasta IS NULL OR d.FechaCreacion <= @FechaHasta)
    ORDER BY d.FechaCreacion DESC;
END

GO

-- ===== sp_ObtenerPasosParaNotificar =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerPasosParaNotificar]
    @IdDocumento UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdGrupo UNIQUEIDENTIFIER;
    DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;

    SELECT TOP 1
        @IdGrupo = IdGrupo,
        @IdDocumentoPrincipal = CASE WHEN EsPrincipal = 1 THEN IdDocumento ELSE NULL END
    FROM [app].[DocumentosConFlujo]
    WHERE IdDocumento = @IdDocumento;

    IF @IdGrupo IS NULL
    BEGIN
        RAISERROR('Documento no encontrado', 16, 1);
        RETURN;
    END

    IF @IdDocumentoPrincipal IS NULL
    BEGIN
        SELECT TOP 1 @IdDocumentoPrincipal = IdDocumento
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo
        ORDER BY CASE WHEN EsPrincipal = 1 THEN 0 ELSE 1 END, FechaSubida;
    END

    -- Obtener el paso actual (primer paso pendiente)
    SELECT TOP 1
        p.IdPaso,
        p.UsuarioAprobador,
        p.Orden,
        p.NotificacionEnviada,
        d.NombreArchivo,
        d.ComentarioInicial,
        d.CreadoPor,
        -- Obtener correo del usuario
        (SELECT Correo FROM [app].[Usuarios]
         WHERE SamAccountName + '@' + Dominio = p.UsuarioAprobador) AS CorreoUsuario,
        -- Obtener nombre del usuario
        (SELECT NombreCompleto FROM [app].[Usuarios]
         WHERE SamAccountName + '@' + Dominio = p.UsuarioAprobador) AS NombreUsuario
    FROM [app].[PasosFlujo] p
    INNER JOIN [app].[DocumentosConFlujo] d ON p.IdDocumento = d.IdDocumento
    WHERE p.IdDocumento = @IdDocumentoPrincipal
        AND p.Estatus = 'Pendiente'
    ORDER BY p.Orden;
END

GO

-- ===== sp_ObtenerTodosLosDocumentos =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerTodosLosDocumentos]
    @Usuario NVARCHAR(255),
    @FiltroUsuario NVARCHAR(255) = NULL,
    @FechaDesde DATETIME = NULL,
    @FechaHasta DATETIME = NULL,
    @EstatusFlujo NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        d.IdDocumento,
        d.NombreArchivo,
        d.FechaCreacion,
        d.EstatusFlujo,
        d.ComentarioInicial,
        d.CreadoPor,
        ISNULL(uc.NombreCompleto, d.CreadoPor) AS NombreCreadoPor,
        d.FechaCompletado,
        d.FechaUltimaAccion,
        d.FechaUltimaAtencion AS FechaUltimaInteraccion,
        -- Información del flujo
        (SELECT COUNT(*) FROM [app].[PasosFlujo] WHERE IdDocumento = d.IdDocumento) AS TotalPasos,
        (SELECT COUNT(*) FROM [app].[PasosFlujo] WHERE IdDocumento = d.IdDocumento AND Estatus = 'Aprobado') AS PasosCompletados,
        -- Usuario actual en el flujo
        (SELECT TOP 1 UsuarioAprobador
         FROM [app].[PasosFlujo]
         WHERE IdDocumento = d.IdDocumento AND Estatus = 'Pendiente'
         ORDER BY Orden) AS PasoActualUsuario,
        ISNULL((SELECT TOP 1 u.NombreCompleto
         FROM [app].[PasosFlujo] pf
         INNER JOIN [app].[Usuarios] u ON pf.UsuarioAprobador = u.SamAccountName + '@' + u.Dominio
         WHERE pf.IdDocumento = d.IdDocumento AND pf.Estatus = 'Pendiente'
         ORDER BY pf.Orden), '') AS NombrePasoActual,
        d.IdGrupo,
        (
            SELECT
                dc.IdDocumento,
                dc.NombreArchivo,
                dc.RutaArchivoInicial,
                dc.RutaArchivoFirmado,
                dc.TipoDocumento,
                dc.EsPrincipal,
                dc.TamanoBytes,
                dc.HashSHA256
            FROM [app].[DocumentosConFlujo] dc
            WHERE dc.IdGrupo = d.IdGrupo
            ORDER BY CASE WHEN dc.EsPrincipal = 1 THEN 0 ELSE 1 END, dc.TipoDocumento, dc.FechaSubida
            FOR JSON PATH
        ) AS Documentos
    FROM [app].[DocumentosConFlujo] d
    LEFT JOIN [app].[Usuarios] uc ON d.CreadoPor = uc.SamAccountName + '@' + uc.Dominio
    WHERE d.Activo = 1
        AND d.EsPrincipal = 1
        -- Solo documentos donde el usuario está involucrado
        AND (
            d.CreadoPor = @Usuario
            OR EXISTS (
                SELECT 1 FROM [app].[PasosFlujo] p
                WHERE p.IdDocumento = d.IdDocumento
                    AND p.UsuarioAprobador = @Usuario
            )
        )
        AND (@FiltroUsuario IS NULL OR d.CreadoPor = @FiltroUsuario)
        AND (@FechaDesde IS NULL OR d.FechaCreacion >= @FechaDesde)
        AND (@FechaHasta IS NULL OR d.FechaCreacion <= @FechaHasta)
        AND (@EstatusFlujo IS NULL OR d.EstatusFlujo = @EstatusFlujo)
    ORDER BY d.FechaCreacion DESC;
END

GO

-- ===== sp_ObtenerUsuariosParaFlujo =====

CREATE OR ALTER PROCEDURE [app].[sp_ObtenerUsuariosParaFlujo]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        SamAccountName + '@' + Dominio AS Usuario,
        NombreCompleto AS NombreCompleto,
        CASE
            WHEN MetadataJson IS NOT NULL
                AND CHARINDEX('"tieneFirma":true', MetadataJson) > 0
            THEN CAST(1 AS BIT)
            ELSE CAST(0 AS BIT)
        END AS TieneFirma,
        CASE
            WHEN MetadataJson IS NOT NULL
                AND CHARINDEX('"identificadorFirma":"', MetadataJson) > 0
            THEN SUBSTRING(
                MetadataJson,
                CHARINDEX('"identificadorFirma":"', MetadataJson) + 22,
                NULLIF(CHARINDEX('"', MetadataJson, CHARINDEX('"identificadorFirma":"', MetadataJson) + 22), 0) - (CHARINDEX('"identificadorFirma":"', MetadataJson) + 22)
            )
            ELSE 'firma_' + LOWER(LEFT(SamAccountName, 10))
        END AS IdentificadorFirma,
        CASE
            WHEN MetadataJson IS NOT NULL
                AND CHARINDEX('"pathFirma":"', MetadataJson) > 0
            THEN SUBSTRING(
                MetadataJson,
                CHARINDEX('"pathFirma":"', MetadataJson) + 13,
                NULLIF(CHARINDEX('"', MetadataJson, CHARINDEX('"pathFirma":"', MetadataJson) + 13), 0) - (CHARINDEX('"pathFirma":"', MetadataJson) + 13)
            )
            ELSE NULL
        END AS PathFirma
    FROM [app].[Usuarios]
    WHERE EsActivo = 1
        AND EsAnonimo = 0
    ORDER BY NombreCompleto;
END

GO

-- ===== sp_RechazarDocumento =====

CREATE OR ALTER PROCEDURE [app].[sp_RechazarDocumento]
    @IdDocumento UNIQUEIDENTIFIER,
    @Usuario NVARCHAR(255),
    @Motivo NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IdGrupo UNIQUEIDENTIFIER;
    DECLARE @IdDocumentoPrincipal UNIQUEIDENTIFIER;

    SELECT TOP 1
        @IdGrupo = IdGrupo,
        @IdDocumentoPrincipal = CASE WHEN EsPrincipal = 1 THEN IdDocumento ELSE NULL END
    FROM [app].[DocumentosConFlujo]
    WHERE IdDocumento = @IdDocumento;

    IF @IdGrupo IS NULL
    BEGIN
        RAISERROR('Documento no encontrado', 16, 1);
        RETURN;
    END

    IF @IdDocumentoPrincipal IS NULL
    BEGIN
        SELECT TOP 1 @IdDocumentoPrincipal = IdDocumento
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo
        ORDER BY CASE WHEN EsPrincipal = 1 THEN 0 ELSE 1 END, FechaSubida;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Rechazar el paso del usuario
        UPDATE [app].[PasosFlujo]
        SET Estatus = 'Rechazado',
            FechaAccion = GETDATE(),
            Comentarios = @Motivo
        WHERE IdDocumento = @IdDocumentoPrincipal
            AND UsuarioAprobador = @Usuario
            AND Estatus = 'Pendiente';

        IF @@ROWCOUNT = 0
        BEGIN
            RAISERROR('No tienes un paso pendiente en este documento', 16, 1);
            RETURN;
        END

        -- Marcar documento como rechazado
        UPDATE [app].[DocumentosConFlujo]
        SET EstatusFlujo = 'Rechazado',
            FechaCompletado = GETDATE(),
            FechaUltimaAccion = GETDATE(),
            FechaUltimaAtencion = GETDATE()
        WHERE IdGrupo = @IdGrupo;

        -- Marcar todos los pasos pendientes restantes como cancelados
        UPDATE [app].[PasosFlujo]
        SET Estatus = 'Cancelado'
        WHERE IdDocumento = @IdDocumentoPrincipal
            AND Estatus = 'Pendiente';

        COMMIT TRANSACTION;

        INSERT INTO [app].[DocumentosHistorial](IdDocumento, Accion, Usuario, FechaAccion, Detalle)
        SELECT IdDocumento, 'RECHAZO', @Usuario, GETDATE(), @Motivo
        FROM [app].[DocumentosConFlujo]
        WHERE IdGrupo = @IdGrupo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END

GO


