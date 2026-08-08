USE Lefarma;
GO

PRINT '';
PRINT '============================================================';
PRINT 'INSERTANDO UNIDADES DE MEDIDA';
PRINT '============================================================';
PRINT '';
GO

-- LONGITUD (id_medida = 1)
IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'cm')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Centimetro', 'centimetro', 'Centesima parte de un metro', 'centesima parte de un metro', 'cm', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'mm')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Milimetro', 'milimetro', 'Milesima parte de un metro', 'milesima parte de un metro', 'mm', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'km')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Kilometro', 'kilometro', 'Mil metros', 'mil metros', 'km', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'in')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Pulgada', 'pulgada', 'Unidad de longitud en el sistema imperial', 'unidad de longitud en el sistema imperial', 'in', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'ft')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Pie', 'pie', 'Doce pulgadas', 'doce pulgadas', 'ft', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'yd')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Yarda', 'yarda', 'Tres pies', 'tres pies', 'yd', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'mi')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (1, 'Milla', 'milla', 'Mil setecientas sesenta yardas', 'mil setecientas sesenta yardas', 'mi', 1, GETDATE());

-- PESO (id_medida = 2)
IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'g')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (2, 'Gramo', 'gramo', 'Milesima parte de un kilogramo', 'milesima parte de un kilogramo', 'g', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'mg')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (2, 'Miligramo', 'miligramo', 'Milesima parte de un gramo', 'milesima parte de un gramo', 'mg', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'lb')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (2, 'Libra', 'libra', 'Unidad de masa en el sistema imperial', 'unidad de masa en el sistema imperial', 'lb', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'oz')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (2, 'Onza', 'onza', 'Dieciseisava parte de una libra', 'dieciseisava parte de una libra', 'oz', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'ton')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (2, 'Tonelada', 'tonelada', 'Mil kilogramos', 'mil kilogramos', 'ton', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 't')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (2, 'Tonelada metrica', 'tonelada metrica', 'Mil kilogramos exactamente', 'mil kilogramos exactamente', 't', 1, GETDATE());

-- VOLUMEN (id_medida = 3)
IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'm3')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Metro cubico', 'metro cubico', 'Unidad de volumen en el SI', 'unidad de volumen en el si', 'm3', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'cm3')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Centimetro cubico', 'centimetro cubico', 'Milesima parte de un litro', 'milesima parte de un litro', 'cm3', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'L')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Litro', 'litro', 'Unidad de volumen equivalente a un decimetro cubico', 'unidad de volumen equivalente a un decimetro cubico', 'L', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'mL')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Mililitro', 'mililitro', 'Milesima parte de un litro', 'milesima parte de un litro', 'mL', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'gal')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Galon', 'galon', 'Unidad de volumen en el sistema imperial', 'unidad de volumen en el sistema imperial', 'gal', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'fl oz')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Onza fluida', 'onza fluida', 'Unidad de volumen en el sistema imperial', 'unidad de volumen en el sistema imperial', 'fl oz', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'hl')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (3, 'Hectolitro', 'hectolitro', 'Cien litros', 'cien litros', 'hl', 1, GETDATE());

-- TIEMPO (id_medida = 4)
IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'min')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (4, 'Minuto', 'minuto', 'Sesenta segundos', 'sesenta segundos', 'min', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'h')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (4, 'Hora', 'hora', 'Sesenta minutos', 'sesenta minutos', 'h', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'dia')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (4, 'Dia', 'dia', 'Veinticuatro horas', 'veinticuatro horas', 'dia', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'sem')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (4, 'Semana', 'semana', 'Siete dias', 'siete dias', 'sem', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'mes')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (4, 'Mes', 'mes', 'Unidad de tiempo calendarico', 'unidad de tiempo calendarico', 'mes', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'ano')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (4, 'Ano', 'ano', 'Doce meses', 'doce meses', 'ano', 1, GETDATE());

-- TEMPERATURA (id_medida = 5)
IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = '°C')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (5, 'Grado Celsius', 'grado celsius', 'Unidad de temperatura en el SI', 'unidad de temperatura en el si', '°C', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = '°F')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (5, 'Grado Fahrenheit', 'grado fahrenheit', 'Unidad de temperatura en el sistema imperial', 'unidad de temperatura en el sistema imperial', '°F', 1, GETDATE());

IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'K')
    INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
    VALUES (5, 'Kelvin', 'kelvin', 'Unidad basica de temperatura termodinamica en el SI', 'unidad basica de temperatura termodinamica en el si', 'K', 1, GETDATE());

-- CANTIDAD (primero crear la categoria si no existe)
IF NOT EXISTS (SELECT * FROM catalogos.medidas WHERE nombre = 'Cantidad')
BEGIN
    INSERT INTO catalogos.medidas (nombre, nombre_normalizado, descripcion, descripcion_normalizada, activo, fecha_creacion)
    VALUES ('Cantidad', 'cantidad', 'Unidades contables sin conversion', 'unidades contables sin conversion', 1, GETDATE());
END
GO

DECLARE @id_cantidad INT = (SELECT id_medida FROM catalogos.medidas WHERE nombre = 'Cantidad');
IF @id_cantidad IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'pza')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Pieza', 'pieza', 'Unidad contable para articulos individuales', 'unidad contable para articulos individuales', 'pza', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'unid')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Unidad', 'unidad', 'Unidad generica', 'unidad generica', 'unid', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'par')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Par', 'par', 'Conjunto de dos unidades', 'conjunto de dos unidades', 'par', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'doc')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Docena', 'docena', 'Doce unidades', 'doce unidades', 'doc', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'caja')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Caja', 'caja', 'Unidad contable para cajas', 'unidad contable para cajas', 'caja', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'paq')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Paquete', 'paquete', 'Unidad contable para paquetes', 'unidad contable para paquetes', 'paq', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'serv')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Servicio', 'servicio', 'Unidad contable para servicios', 'unidad contable para servicios', 'serv', 1, GETDATE());

    IF NOT EXISTS (SELECT * FROM catalogos.unidades_medida WHERE abreviatura = 'lote')
        INSERT INTO catalogos.unidades_medida (id_medida, nombre, nombre_normalizado, descripcion, descripcion_normalizada, abreviatura, activo, fecha_creacion)
        VALUES (@id_cantidad, 'Lote', 'lote', 'Unidad contable para lotes', 'unidad contable para lotes', 'lote', 1, GETDATE());
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'UNIDADES DE MEDIDA INSERTADAS';
PRINT '============================================================';
PRINT '';
PRINT 'Verifica con: SELECT * FROM catalogos.unidades_medida;';
PRINT '';
GO
