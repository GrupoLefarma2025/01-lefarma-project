// Lefarma.Migrations — DbUp-based database migration runner.
// Usage:
//   lefarma-migrations status <env> [--app X] [--tipo Y] [--json]
//   lefarma-migrations apply   <env> [--app X] [--tipo Y] [--id ID]
//   lefarma-migrations diff    <fromEnv> <toEnv>
//   lefarma-migrations list    <env>
//
// Environment variables override migrations.config.json:
//   MIGRATIONS_CONFIG_PATH=path/to/config.json
//
// SQL scripts can declare target DBs via header:
//   -- Target: AsokamDev, LefarmaDev
// If absent, the app folder name is mapped via "routing" in config.
// If app is "_shared" or not in routing, the script applies to ALL DBs in the env.

using System.Text.Json;
using DbUp;
using DbUp.Engine;
using DbUp.ScriptProviders;
using Microsoft.Data.SqlClient;

return Run(args);

static int Run(string[] args)
{
    if (args.Length == 0)
    {
        PrintUsage();
        return 1;
    }

    var command = args[0].ToLowerInvariant();
    return command switch
    {
        "status" => Status(args.Skip(1).ToArray()),
        "apply"  => Apply(args.Skip(1).ToArray()),
        "diff"   => Diff(args.Skip(1).ToArray()),
        "list"   => ListApplied(args.Skip(1).ToArray()),
        _        => PrintUnknown(command)
    };
}

// ============== Commands ==============

static int Status(string[] args)
{
    var env = args.ElementAtOrDefault(0) ?? "dev";
    var app = Flag(args, "--app");
    var tipo = Flag(args, "--tipo");
    var asJson = HasFlag(args, "--json");

    var cfg = LoadConfig();
    var scriptsRoot = FindScriptsRoot();
    var dbs = cfg.GetDbs(env);

    var pendingByDb = new List<(string Db, string App, string Tipo, string Id)>();

    foreach (var (db, connString) in dbs)
    {
        var upgrader = BuildUpgrader(connString, scriptsRoot, db, app, tipo, cfg);
        var scriptsToExecute = upgrader.GetScriptsToExecute();

        foreach (var s in scriptsToExecute)
        {
            var parsed = ParseScriptPath(s.SqlScript.FilePath);
            pendingByDb.Add((db, parsed.App, parsed.Tipo, parsed.Id));
        }
    }

    if (asJson)
    {
        Console.WriteLine(JsonSerializer.Serialize(pendingByDb.Select(p => new
        {
            db = p.Db, app = p.App, tipo = p.Tipo, id = p.Id
        }), JsonOpts));
    }
    else
    {
        Console.WriteLine($"\n=== Pendientes en {env} ===");
        if (pendingByDb.Count == 0)
        {
            Console.WriteLine("  (sin pendientes — todo aplicado)");
        }
        else
        {
            foreach (var g in pendingByDb.GroupBy(p => p.Db))
            {
                Console.WriteLine($"\n  [{g.Key}]");
                foreach (var p in g)
                    Console.WriteLine($"    [ ] {p.Id,-40} {p.App}/{p.Tipo}");
            }
        }
    }
    return 0;
}

static int Apply(string[] args)
{
    var env = args.ElementAtOrDefault(0) ?? "dev";
    var app = Flag(args, "--app");
    var tipo = Flag(args, "--tipo");
    var id = Flag(args, "--id");

    var cfg = LoadConfig();
    var scriptsRoot = FindScriptsRoot();
    var dbs = cfg.GetDbs(env);

    var overallSuccess = true;
    foreach (var (db, connString) in dbs)
    {
        Console.WriteLine($"\n=== {db} ({env}) ===");
        var upgrader = BuildUpgrader(connString, scriptsRoot, db, app, tipo, cfg, id);
        var result = upgrader.PerformUpgrade();

        if (!result.Successful)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  FAIL: {result.Error.Message}");
            Console.ResetColor();
            overallSuccess = false;
            break;  // abort on first failure within this DB
        }
    }

    if (!overallSuccess)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"\nMigración abortada con errores en {env}.");
        Console.ResetColor();
        return 1;
    }

    Console.ForegroundColor = ConsoleColor.Green;
    Console.WriteLine($"\nOK — {env} actualizado.");
    Console.ResetColor();
    return 0;
}

static int Diff(string[] args)
{
    var fromEnv = args.ElementAtOrDefault(0);
    var toEnv = args.ElementAtOrDefault(1);
    if (fromEnv == null || toEnv == null)
    {
        Console.Error.WriteLine("Usage: diff <fromEnv> <toEnv>");
        return 1;
    }

    var cfg = LoadConfig();
    var fromDbs = cfg.GetDbs(fromEnv);
    var toDbs = cfg.GetDbs(toEnv);

    var commonDbs = fromDbs.Keys.Intersect(toDbs.Keys).OrderBy(k => k);
    foreach (var db in commonDbs)
    {
        var fromApplied = GetAppliedScripts(fromDbs[db]);
        var toApplied = GetAppliedScripts(toDbs[db]);
        var missingInTo = fromApplied.Except(toApplied).OrderBy(s => s);

        Console.WriteLine($"\n=== {db}: en {fromEnv}, pendientes en {toEnv} ===");
        if (!missingInTo.Any())
            Console.WriteLine("  (sin diferencias)");
        else
            foreach (var s in missingInTo)
                Console.WriteLine($"  {s}");
    }
    return 0;
}

static int ListApplied(string[] args)
{
    var env = args.ElementAtOrDefault(0) ?? "dev";
    var cfg = LoadConfig();
    var dbs = cfg.GetDbs(env);

    foreach (var (db, connString) in dbs)
    {
        Console.WriteLine($"\n=== {db} ({env}) — aplicadas ===");
        var applied = GetAppliedScripts(connString);
        if (!applied.Any())
            Console.WriteLine("  (sin migraciones aplicadas)");
        else
            foreach (var s in applied)
                Console.WriteLine($"  [x] {s}");
    }
    return 0;
}

// ============== Helpers ==============

static UpgradeEngine BuildUpgrader(string connString, string scriptsRoot,
    string db, string? appFilter, string? tipoFilter, Config cfg, string? idFilter = null)
{
    var appFolders = cfg.GetAppFolders(db, appFilter);  // list of app paths under scriptsRoot

    var options = new FileSystemScriptOptions
    {
        IncludeSubDirectories = true,
        Extensions = new[] { "*.sql" },
        Encoding = System.Text.Encoding.UTF8,
        Filter = path =>
        {
            // Filter by tipo folder
            if (tipoFilter != null && !path.Contains($"\\{tipoFilter}\\") && !path.Contains($"/{tipoFilter}/"))
                return false;
            // Filter by exact id (must match filename prefix "<id>_" — 4-digit zero-padded by convention)
            if (idFilter != null)
            {
                var name = Path.GetFileNameWithoutExtension(path);
                if (!name.StartsWith(idFilter + "_", StringComparison.OrdinalIgnoreCase))
                    return false;
            }
            // Filter by Target header: if SQL declares -- Target: X,Y then must include this db
            var target = ReadTargetHeader(path);
            if (target != null && !target.Contains(db, StringComparer.OrdinalIgnoreCase))
                return false;
            return true;
        }
    };

    var providers = appFolders
        .Select(p => new FileSystemScriptProvider(p, options))
        .Cast<IScriptProvider>()
        .ToArray();

    var builder = DeployChanges.To
        .SqlDatabase(connString)
        .WithScripts(new CompositeScriptProvider(providers))
        .JournalToSqlTable("app", "SchemaVersions")
        .WithTransactionPerScript()
        .WithExecutionTimeout(TimeSpan.FromMinutes(10))
        .LogToConsole();

    return builder.Build();
}

static string? ReadTargetHeader(string sqlPath)
{
    try
    {
        if (!File.Exists(sqlPath)) return null;
        var firstLines = File.ReadLines(sqlPath).Take(10);
        foreach (var line in firstLines)
        {
            var trimmed = line.TrimStart('-', ' ', '\t');
            if (trimmed.StartsWith("Target:", StringComparison.OrdinalIgnoreCase))
                return trimmed["Target:".Length..].Trim();
        }
    }
    catch { /* ignore — assume no target */ }
    return null;
}

static (string App, string Tipo, string Id) ParseScriptPath(string path)
{
    // .../educacion-medica/schema/20260805-0935-create-talleres.sql
    var segments = path.Replace('/', '\\').Split('\\');
    var file = segments.Last().Replace(".sql", "");
    var tipo = segments.Length >= 2 ? segments[^2] : "?";
    var app  = segments.Length >= 3 ? segments[^3] : "?";
    return (app, tipo, file);
}

static HashSet<string> GetAppliedScripts(string connString)
{
    var applied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    try
    {
        using var conn = new SqlConnection(connString);
        conn.Open();
        using var cmd = new SqlCommand(
            "SELECT ScriptName FROM app.SchemaVersions ORDER BY Applied",
            conn);
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
            applied.Add(reader.GetString(0));
    }
    catch
    {
        // Table might not exist yet — return empty.
    }
    return applied;
}

static Config LoadConfig()
{
    var configPath = Environment.GetEnvironmentVariable("MIGRATIONS_CONFIG_PATH")
        ?? Path.Combine(AppContext.BaseDirectory, "migrations.config.json");
    var json = File.ReadAllText(configPath);
    return JsonSerializer.Deserialize<Config>(json, JsonOpts) ?? throw new("Invalid config");
}

static string FindScriptsRoot()
{
    // Walk up from CWD until we find lefarma.database/
    var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
    while (dir != null)
    {
        var candidate = Path.Combine(dir.FullName, "lefarma.database");
        if (Directory.Exists(candidate)) return candidate;
        dir = dir.Parent;
    }
    throw new DirectoryNotFoundException("No se encontró lefarma.database/ en el árbol.");
}

static string? Flag(string[] args, string name)
{
    var idx = Array.IndexOf(args, name);
    return idx >= 0 && idx + 1 < args.Length ? args[idx + 1] : null;
}

static bool HasFlag(string[] args, string name) => args.Contains(name);

static void PrintUsage()
{
    Console.WriteLine("""
        Lefarma.Migrations — DbUp runner.

        Uso:
          lefarma-migrations status <env> [--app X] [--tipo Y] [--json]
          lefarma-migrations apply   <env> [--app X] [--tipo Y] [--id ID]
          lefarma-migrations diff    <fromEnv> <toEnv>
          lefarma-migrations list    <env>

        Env: dev | qa | prod
        Tipo: schema | alter | data
        App: _shared | educacion-medica | rh | cxp | ...
        Id: nombre del script sin .sql (ej: 20260805-0935-create-talleres)
        """);
}

static int PrintUnknown(string cmd)
{
    Console.Error.WriteLine($"Comando desconocido: {cmd}");
    PrintUsage();
    return 1;
}

static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

// ============== Config model ==============

class Config
{
    public Dictionary<string, Dictionary<string, string>> Environments { get; set; } = new();
    public Dictionary<string, string[]> Routing { get; set; } = new();

    public Dictionary<string, string> GetDbs(string env)
    {
        if (!Environments.TryGetValue(env, out var dbs) || dbs.Count == 0)
            throw new($"Ambiente '{env}' no definido o vacío en migrations.config.json");
        return dbs;
    }

    public List<string> GetAppFolders(string db, string? appFilter)
    {
        // Returns list of full app folders under scriptsRoot that should apply to this db.
        // Filter rules:
        //   - If appFilter is set, ONLY that app folder is included.
        //   - Otherwise, walk all top-level app folders under scriptsRoot and:
        //       - skip "_shared" (handled below)
        //       - include if Routing[app] contains db OR Routing[app] is ["*"]
        //   - Always include "_shared" if Routing["_shared"] is ["*"] or contains db.
        var root = FindScriptsRoot();
        var folders = new List<string>();

        var allApps = Directory.GetDirectories(root).Select(d => Path.GetFileName(d)).ToList();
        foreach (var appName in allApps)
        {
            if (appFilter != null && !string.Equals(appName, appFilter, StringComparison.OrdinalIgnoreCase))
                continue;

            var targets = Routing.TryGetValue(appName, out var t) ? t : new[] { "*" };
            var appliesToThisDb = targets.Contains("*") || targets.Contains(db, StringComparer.OrdinalIgnoreCase);
            if (appliesToThisDb)
                folders.Add(Path.Combine(root, appName));
        }
        return folders;
    }
}
