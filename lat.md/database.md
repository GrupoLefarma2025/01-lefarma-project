# Database

SQL Server + Entity Framework Core 10 — migrations, schema, seed data.

## Connections

Configuración de conexiones a base de datos.

- **DefaultConnection** → Lefarma database
- **AsokamConnection** → Asokam database (referencias)

Server: `192.168.4.2`

## Migrations

Gestión de migraciones EF Core.

EF Core migrations en:
`lefarma.backend/src/Lefarma.API/Infrastructure/Data/Migrations/`

```bash
dotnet ef migrations add [Name]
dotnet ef database update
```

## Scripts

Scripts SQL para inicialización.

- `000_create_tables.sql` — Schema inicial
- `001_seed_data.sql` — Datos seed

## Diagrams

Diagramas de base de datos.

- `db_diagrama_propuesta_v1.png`
- `db_diagrama_propuesta_v2.png`

## Key Entities

Entidades principales del sistema.

- **Catalogos:** Empresas, Sucursales, UnidadesMedida, Proveedores, FormasPago, Bancos, CuentasContables, CentrosCosto
- **Workflow:** Pasos, Participantes, Aprobaciones
- **Notifications:** Canales (Email, Telegram, In-App)

## Key Files

Archivos clave de acceso a datos.

- `ApplicationDbContext.cs` — DbContext principal

// @lat: [[index]]
