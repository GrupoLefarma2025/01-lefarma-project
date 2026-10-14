-- ============================================================================
-- 042 — Carga de saldos de vacaciones desde Excel "Vacaciones México agosto 2026"
-- Fuente: Hoja1 (columna G = SALDO DE VACACIONES; verificado G = D - E en 200/200)
-- Objetivo: dias_pendientes (computada) == SALDO del Excel, ajustando SOLO
--           dias_generados (los tomados del sistema se conservan):
--           generados = SALDO - compensados - ajustados + vencidos + tomados
-- Llave: correo (lower/trim) via app.Usuarios -> rh.saldos_vacaciones_anuales
-- Año: 2026 (cambiar @Anio si aplica). Solo filas activas.
-- ORDEN: correr Paso 0 (lectura), revisar excepciones, luego Paso 1, luego Paso 2.
-- ============================================================================

DECLARE @Anio INT = 2026;
DECLARE @Motivo NVARCHAR(300) = N'Carga Excel vacaciones agosto 2026';

IF OBJECT_ID('tempdb..#ExcelSaldos') IS NOT NULL DROP TABLE #ExcelSaldos;
CREATE TABLE #ExcelSaldos (correo NVARCHAR(512) NOT NULL, saldo DECIMAL(5,2) NOT NULL);

INSERT INTO #ExcelSaldos (correo, saldo) VALUES
    (N'1a16@asokam.mx', 1),
    (N'1cm4@construmedika.com', 1),
    (N'2g6@lefarma.com.mx', 30),
    (N'1a14@asokam.mx', 3),
    (N'2g22@lefarma.com.mx', 0),
    (N'2g8@lefarma.com.mx', 19),
    (N'1a4@asokam.mx', 8),
    (N'1a41@asokam.mx', 1),
    (N'2g3@lefarma.com.mx', 63),
    (N'1a901@asokam.mx', 0),
    (N'1a902@asokam.mx', -7),
    (N'2g900@lefarma.com.mx', 10),
    (N'2g4@lefarma.com.mx', 129),
    (N'1cm6@construmedika.com', 0),
    (N'2g13@lefarma.com.mx', 23),
    (N'1a26@asokam.mx', 6),
    (N'2g10@lefarma.com.mx', -4),
    (N'2g12@lefarma.com.mx', -10),
    (N'1a37@asokam.mx', 0),
    (N'2g9@lefarma.com.mx', 136),
    (N'1a47@asokam.mx', -2),
    (N'2g20@lefarma.com.mx', 1),
    (N'2g21@lefarma.com.mx', -3),
    (N'1a34@asokam.mx', -3),
    (N'1a12@asokam.mx', -1),
    (N'1a6@asokam.mx', -9),
    (N'40@grupolefarma.com.mx', 13),
    (N'2g14@lefarma.com.mx', 1),
    (N'1a130@asokam.mx', 4),
    (N'43@grupolefarma.com.mx', 6),
    (N'54@grupolefarma.com.mx', 8),
    (N'1a32@asokam.mx', -8),
    (N'1a17@asokam.mx', 0),
    (N'5@grupolefarma.com.mx', 139),
    (N'1a904@asokam.mx', -1),
    (N'2g901@lefarma.com.mx', 8),
    (N'1a11@asokam.mx', -4),
    (N'19@grupolefarma.com.mx', 1),
    (N'2g11@lefarma.com.mx', 0),
    (N'1cm13@construmedika.com', 89),
    (N'1a903@asokam.mx', -2),
    (N'1a42@asokam.mx', 2),
    (N'50@grupolefarma.com.mx', -2),
    (N'1a48@asokam.mx', 2),
    (N'1a22@asokam.mx', 0),
    (N'1a10@asokam.mx', 2),
    (N'44@grupolefarma.com.mx', -10),
    (N'1a19@asokam.mx', 4),
    (N'1a27@asokam.mx', -11),
    (N'1a1@asokam.mx', 14),
    (N'1a18@asokam.mx', -9),
    (N'45@grupolefarma.com.mx', -2),
    (N'1a40@asokam.mx', 8),
    (N'1a900@asokam.mx', 14),
    (N'33@grupolefarma.com.mx', 49),
    (N'2g2@lefarma.com.mx', 109),
    (N'1a33@asokam.mx', -2),
    (N'1a129@asokam.mx', 52),
    (N'1a9@asokam.mx', 10),
    (N'41@grupolefarma.com.mx', -10),
    (N'1a15@asokam.mx', 20),
    (N'1a21@asokam.mx', 19),
    (N'1a25@asokam.mx', -13),
    (N'cat3@artricenter.com.mx', -3),
    (N'42@grupolefarma.com.mx', 11),
    (N'10@grupolefarma.com.mx', 3),
    (N'3a900@artricenter.com.mx', 46),
    (N'3a10@artricenter.com.mx', 5),
    (N'1r900@artricenter.com.mx', 38),
    (N'4v903@artricenter.com.mx', 7),
    (N'21@grupolefarma.com.mx', 28),
    (N'cat11@artricenter.com.mx', -1),
    (N'14@grupolefarma.com.mx', -9),
    (N'3a28@artricenter.com.mx', 3),
    (N'3a25@artricenter.com.mx', -3),
    (N'4v15@artricenter.com.mx', 0),
    (N'24@grupolefarma.com.mx', -5),
    (N'3a13@artricenter.com.mx', 6),
    (N'3a20@artricenter.com.mx', -11),
    (N'2z11@artricenter.com.mx', 21),
    (N'7@grupolefarma.com.mx', 26),
    (N'22@grupolefarma.com.mx', 27),
    (N'52@grupolefarma.com.mx', 14),
    (N'3a904@artricenter.com.mx', 0),
    (N'cc23@artricenter.com.mx', 31),
    (N'2z28@artricenter.com.mx', 10),
    (N'3a22@artricenter.com.mx', 1),
    (N'1r27@artricenter.com.mx', -9),
    (N'1cm11@construmedika.com', 12),
    (N'1r11@artricenter.com.mx', 0),
    (N'3a19@artricenter.com.mx', -9),
    (N'4v904@artricenter.com.mx', 10),
    (N'2z12@artricenter.com.mx', 40),
    (N'1cm903@construmedika.com', 10),
    (N'cat2@artricenter.com.mx', 17),
    (N'cc27@artricenter.com.mx', 2),
    (N'4@grupolefarma.com.mx', 46),
    (N'3a24@artricenter.com.mx', -3),
    (N'r2@artricenter.com.mx', 65),
    (N'1r17@artricenter.com.mx', -3),
    (N'3a16@artricenter.com.mx', 8),
    (N'cat12@artricenter.com.mx', -12),
    (N'1r18@artricenter.com.mx', 0),
    (N'1r30@artricenter.com.mx', 47),
    (N'cat10@artricenter.com.mx', -2),
    (N'cat9@artricenter.com.mx', 2),
    (N'cc3@artricenter.com.mx', 16),
    (N'2z13@artricenter.com.mx', 0),
    (N'3a11@artricenter.com.mx', 31),
    (N'4v902@artricenter.com.mx', 17),
    (N'4v3@artricenter.com.mx', 0),
    (N'1r26@artricenter.com.mx', 0),
    (N'1r21@artricenter.com.mx', 54),
    (N'3a903@artricenter.com.mx', 5),
    (N'4v8@artricenter.com.mx', -11),
    (N'1r20@artricenter.com.mx', 0),
    (N'17@grupolefarma.com.mx', 6),
    (N'2z7@artricenter.com.mx', 23),
    (N'3a17@artricenter.com.mx', 0),
    (N'1r14@artricenter.com.mx', 3),
    (N'6@grupolefarma.com.mx', 3),
    (N'23@grupolefarma.com.mx', 4),
    (N'1r29@artricenter.com.mx', -9),
    (N'1r13@artricenter.com.mx', -3),
    (N'3a7@artricenter.com.mx', 40),
    (N'4v11@artricenter.com.mx', 5),
    (N'9@grupolefarma.com.mx', 36),
    (N'cat4@artricenter.com.mx', 22),
    (N'2z5@artricenter.com.mx', 32),
    (N'32@grupolefarma.com.mx', -9),
    (N'cc9@artricenter.com.mx', 0),
    (N'1r903@artricenter.com.mx', 2),
    (N'cc7@artricenter.com.mx', 39),
    (N'4v12@artricenter.com.mx', -3),
    (N'1cm901@construmedika.com', 134),
    (N'35@grupolefarma.com.mx', 8),
    (N'15@grupolefarma.com.mx', 27),
    (N'1r28@artricenter.com.mx', 28),
    (N'4v900@artricenter.com.mx', -3),
    (N'4v17@artricenter.com.mx', 6),
    (N'4v16@artricenter.com.mx', 4),
    (N'cat14@artricenter.com.mx', -12),
    (N'4v905@artricenter.com.mx', -10),
    (N'1r2@artricenter.com.mx', 9),
    (N'3a14@artricenter.com.mx', 7),
    (N'1r5@artricenter.com.mx', 0),
    (N'29@grupolefarma.com.mx', 13),
    (N'1r32@artricenter.com.mx', -2),
    (N'1r16@artricenter.com.mx', 53),
    (N'2z27@artricenter.com.mx', -3),
    (N'3a21@artricenter.com.mx', -4),
    (N'1r902@artricenter.com.mx', -12),
    (N'4v9@artricenter.com.mx', 71),
    (N'36@grupolefarma.com.mx', -3),
    (N'4v18@artricenter.com.mx', 27),
    (N'1r906@artricenter.com.mx', 10),
    (N'30@grupolefarma.com.mx', 36),
    (N'cat7@artricenter.com.mx', -3),
    (N'4v21@artricenter.com.mx', -5),
    (N'2z8@artricenter.com.mx', 37),
    (N'11@grupolefarma.com.mx', 49),
    (N'4v7@artricenter.com.mx', 0),
    (N'cat5@artricenter.com.mx', -6),
    (N'4v14@artricenter.com.mx', 3),
    (N'1r36@artricenter.com.mx', 14),
    (N'3a12@artricenter.com.mx', 13),
    (N'1cm3@construmedika.com', 0),
    (N'1cm900@construmedika.com', 136),
    (N'1cm2@construmedika.com', 188),
    (N'1cm904@construmedika.com', 27),
    (N'3a18@artricenter.com.mx', 7),
    (N'4v901@artricenter.com.mx', 1),
    (N'4v13@artricenter.com.mx', 57),
    (N'r6@artricenter.com.mx', 0),
    (N'cat8@artricenter.com.mx', -5),
    (N'3a23@artricenter.com.mx', 4),
    (N'1r22@artricenter.com.mx', 1),
    (N'3@grupolefarma.com.mx', 0),
    (N'4v19@artricenter.com.mx', -9),
    (N'1cm5@construmedika.com', 12),
    (N'26@grupolefarma.com.mx', 40),
    (N'1cm902@construmedika.com', 42),
    (N'4v32@artricenter.com.mx', -11),
    (N'3a902@artricenter.com.mx', 0),
    (N'3a1@artricenter.com.mx', 4);

-- ----------------------------------------------------------------------------
-- PASO 0 (solo lectura): vista previa de lo que se va a actualizar
-- ----------------------------------------------------------------------------
SELECT
    u.IdUsuario,
    u.NombreCompleto,
    u.Correo,
    s.id_saldo,
    s.dias_generados   AS generados_hoy,
    s.dias_tomados     AS tomados_sistema,
    e.saldo            AS saldo_excel,
    e.saldo - s.dias_compensados - s.dias_ajustados + s.dias_vencidos + s.dias_tomados AS generados_nuevo
FROM #ExcelSaldos AS e
JOIN app.Usuarios AS u
    ON LOWER(LTRIM(RTRIM(u.Correo))) = e.correo
JOIN rh.saldos_vacaciones_anuales AS s
    ON s.id_usuario = u.IdUsuario
    AND s.anio = @Anio
    AND s.activo = 1
ORDER BY u.NombreCompleto;

-- Excepciones: correos del Excel sin usuario, o sin saldo en el año, o ambiguos
SELECT e.correo, e.saldo, 'SIN_USUARIO' AS motivo
FROM #ExcelSaldos AS e
WHERE NOT EXISTS (
    SELECT 1 FROM app.Usuarios AS u
    WHERE LOWER(LTRIM(RTRIM(u.Correo))) = e.correo
)
UNION ALL
SELECT e.correo, e.saldo, 'SIN_SALDO_EN_ANIO' AS motivo
FROM #ExcelSaldos AS e
JOIN app.Usuarios AS u
    ON LOWER(LTRIM(RTRIM(u.Correo))) = e.correo
WHERE NOT EXISTS (
    SELECT 1 FROM rh.saldos_vacaciones_anuales AS s
    WHERE s.id_usuario = u.IdUsuario AND s.anio = @Anio AND s.activo = 1
)
UNION ALL
SELECT e.correo, e.saldo, 'CORREO_AMBIGUO' AS motivo
FROM #ExcelSaldos AS e
WHERE (
    SELECT COUNT(*) FROM app.Usuarios AS u
    WHERE LOWER(LTRIM(RTRIM(u.Correo))) = e.correo
) > 1;

-- ----------------------------------------------------------------------------
-- PASO 1: UPDATE (correr solo después de revisar el Paso 0)
-- ----------------------------------------------------------------------------
-- BEGIN TRANSACTION;
UPDATE s
SET s.dias_generados = e.saldo
        - s.dias_compensados
        - s.dias_ajustados
        + s.dias_vencidos
        + s.dias_tomados,
    s.motivo_ajuste = @Motivo,
    s.fecha_modificacion = GETDATE()
FROM rh.saldos_vacaciones_anuales AS s
JOIN app.Usuarios AS u
    ON u.IdUsuario = s.id_usuario
JOIN #ExcelSaldos AS e
    ON LOWER(LTRIM(RTRIM(u.Correo))) = e.correo
WHERE s.anio = @Anio
    AND s.activo = 1;
-- COMMIT TRANSACTION;  -- descomentar el BEGIN/COMMIT para aplicar atómico
-- ROLLBACK TRANSACTION;

-- ----------------------------------------------------------------------------
-- PASO 2 (solo lectura): verificación — debe regresar 0 filas
-- ----------------------------------------------------------------------------
SELECT u.NombreCompleto, u.Correo, s.dias_pendientes, e.saldo AS saldo_excel
FROM #ExcelSaldos AS e
JOIN app.Usuarios AS u
    ON LOWER(LTRIM(RTRIM(u.Correo))) = e.correo
JOIN rh.saldos_vacaciones_anuales AS s
    ON s.id_usuario = u.IdUsuario
    AND s.anio = @Anio
    AND s.activo = 1
WHERE s.dias_pendientes <> e.saldo;

DROP TABLE #ExcelSaldos;
