USE [Asokam]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Cambios contra la versión anterior:
--   1. Devuelve la columna Error (antes se tiraba el mensaje de python).
--   2. Si no hay JSON, explica qué pasó en vez de devolver 5 NULL.
--   3. Toma la ÚLTIMA línea con CodigoEstatus y reconstruye el JSON si
--      xp_cmdshell lo partió en renglones.
--   4. Cita el folio en el comando (folios con espacios rompían el argv).
--   5. @folioDocumento pasa a varchar(30) para igualar la columna.
ALTER procedure [dbo].[SP_CargarValidadorCFDI] @folioDocumento varchar(30)
AS
begin
	set nocount on;

	declare @cmd nvarchar(4000)

	set @cmd = 'python "C:\Sistemas\Script\validarCfdi.py" "' + @folioDocumento + '"'

	-- id conserva el orden real de la salida de xp_cmdshell
	declare @cmd_output table (
		id int identity(1,1),
		output_line nvarchar(4000)
	)

	insert into @cmd_output (output_line)
	exec xp_cmdshell @cmd

	declare @jsontable nvarchar(max)

	select top (1) @jsontable = output_line
	from @cmd_output
	where output_line like '%"CodigoEstatus"%'
	order by id desc

	-- xp_cmdshell entrega la salida en renglones de 255 caracteres: si el JSON
	-- quedó partido, se rearma juntando desde el renglón donde empieza.
	if @jsontable is null or isjson(@jsontable) = 0
	begin
		declare @desde int

		select @desde = min(id)
		from @cmd_output
		where output_line like '%"CodigoEstatus"%'

		if @desde is not null
		begin
			select @jsontable = string_agg(output_line, '') within group (order by id)
			from @cmd_output
			where id >= @desde
			  and output_line is not null
		end
	end

	-- Sin salida JSON: xp_cmdshell apagado, ruta del .py mala, python fuera
	-- del PATH o excepción antes del print. Antes eran 5 NULL sin pistas.
	if @jsontable is null or isjson(@jsontable) = 0
	begin
		select cast(null as nvarchar(255)) as CodigoEstatus,
		       cast(null as nvarchar(255)) as EsCancelable,
		       cast(null as nvarchar(255)) as Estado,
		       cast(null as nvarchar(255)) as EstatusCancelacion,
		       cast(null as nvarchar(255)) as ValidacionEFOS,
		       cast('Sin salida JSON de python. Última línea de xp_cmdshell: '
		            + isnull((select top 1 output_line from @cmd_output order by id desc), '(nada)')
		            as nvarchar(4000)) as Error
		return
	end

	select JSON_VALUE(@jsontable, '$.CodigoEstatus')      as CodigoEstatus,
	       JSON_VALUE(@jsontable, '$.EsCancelable')       as EsCancelable,
	       JSON_VALUE(@jsontable, '$.Estado')             as Estado,
	       JSON_VALUE(@jsontable, '$.EstatusCancelacion') as EstatusCancelacion,
	       JSON_VALUE(@jsontable, '$.ValidacionEFOS')     as ValidacionEFOS,
	       JSON_VALUE(@jsontable, '$.Error')              as Error
end
GO
