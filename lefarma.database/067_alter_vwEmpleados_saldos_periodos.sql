/*
    Ejecutar en el servidor de Asistencias (ESFR-DOCTS), base Asistencias.
    No ejecutar en Lefarma.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

ALTER VIEW [dbo].[vwEmpleados]
AS
SELECT
    emp.id,
    create_time AS fechaAlta,
    change_time AS ultimocambio,
    emp_code AS nomina,
    first_name AS nombre,
    last_name AS apellidos,
    emp.email AS correo,
    COALESCE(passport, '') AS jefe,
    gender AS genero,
    birthday AS fechanacimiento,
    dbo.fn_ObtenerAñosTranscurridos(birthday) AS edad,
    hire_date AS fechaingreso,
    dbo.fn_ObtenerAñosTranscurridos(hire_date) AS antiguedad,
    CASE
        WHEN dbo.fn_ObtenerAñosTranscurridos(hire_date) = 0 THEN 0
        WHEN dbo.fn_ObtenerAñosTranscurridos(hire_date) BETWEEN 1 AND 5
            THEN 10 + (dbo.fn_ObtenerAñosTranscurridos(hire_date) * 2)
        WHEN dbo.fn_ObtenerAñosTranscurridos(hire_date) >= 6
            THEN 22 + (CEILING((dbo.fn_ObtenerAñosTranscurridos(hire_date) - 10) / 5.0) * 2)
    END AS vacacionesxantiguedadASumar,
    COALESCE(sv.dias_generados, 0) AS vacacionesxantiguedad,
    postcode AS cp,
    office_tel AS telefonooficina,
    mobile AS celularoficina,
    emp.contact_tel AS telefonopersonal,
    emp.nickname AS ubicacion,
    CASE
        WHEN CHARINDEX('asokam', COALESCE(emp.email, '')) > 0 THEN 'ASOKAM'
        WHEN CHARINDEX('construmedika', COALESCE(emp.email, '')) > 0 THEN 'CONSTRUMEDIKA'
        WHEN CHARINDEX('artricenter', COALESCE(emp.email, '')) > 0 THEN 'ARTRICENTER'
        WHEN CHARINDEX('@lefarma', COALESCE(emp.email, '')) > 0 THEN 'LEFARMA'
        WHEN CHARINDEX('grupolefarma', COALESCE(emp.email, '')) > 0 THEN 'GRUPO LEFARMA'
        ELSE REPLACE(UPPER(COALESCE(emp.[national], '')), 'Reumedika', 'ARTRICENTER')
    END AS empresa,
    REPLACE(UPPER(CASE
        WHEN COALESCE(emp.[national], '') = '' THEN COALESCE(da.dominio,
            CASE
                WHEN CHARINDEX('asokam', emp.email) > 0 THEN 'ASOKAM'
                WHEN CHARINDEX('construmedika', emp.email) > 0 THEN 'CONSTRUMEDIKA'
                WHEN CHARINDEX('artricenter', emp.email) > 0 THEN 'ARTRICENTER'
                ELSE ''
            END)
        ELSE emp.[national]
    END), 'ARTRICENTER', 'REUMEDIKA') AS empresareal,
    d.dept_name AS departamento,
    pp.position_name AS puesto,
    lr.area_name AS lugarregistro,
    emp.city AS ciudad,
    address AS direccion,
    ua.areasautorizadas AS ubicacionesautorizadas,
    CASE WHEN enable_att = 1 THEN 'Si' ELSE 'No' END AS checa,
    COALESCE(dach.lunes, 0) AS Lunes,
    COALESCE(dach.martes, 1) AS Martes,
    COALESCE(dach.miercoles, 1) AS Miercoles,
    COALESCE(dach.jueves, 1) AS Jueves,
    COALESCE(dach.viernes, 1) AS Viernes,
    COALESCE(dach.sabado, 1) AS Sabado,
    COALESCE(dach.domingo, 0) AS Domingo
FROM personnel_employee emp
LEFT JOIN diasAChecar dach ON dach.nomina = emp.emp_code
LEFT JOIN personnel_department d ON d.id = emp.department_id
LEFT JOIN personnel_position pp ON pp.id = emp.position_id
LEFT JOIN vwLugarRegistro lr ON lr.employee_id = emp.id
LEFT JOIN vwUbicacionesAutorizadas ua ON ua.id = emp.id
LEFT JOIN OPENQUERY([192.168.4.2], '
    SELECT v.dias_generados, u.correo
    FROM Lefarma.rh.saldos_vacaciones_periodos v
    INNER JOIN Asokam.app.usuarios u ON u.idusuario = v.id_usuario
    WHERE v.activo = 1
      AND CAST(GETDATE() AS DATE) BETWEEN v.fecha_inicio_periodo AND v.fecha_fin_periodo
') sv ON sv.correo = emp.email
LEFT JOIN (
    SELECT
        REPLACE(userprincipalname, 'artricenter.mx', 'artricenter.com.mx') AS email,
        REPLACE(dominio, 'Grupolefarma', 'Asokam') AS dominio
    FROM directorioactivo
    WHERE CHARINDEX('@' + dominio, userprincipalname) > 0
) da ON da.email = emp.email
WHERE status = 0;
GO
