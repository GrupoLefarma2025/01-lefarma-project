using System.Text.Json;
using DbUp;
using DbUp.Engine;
using DbUp.Engine.Output;
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

static int Status(string[] args)
{
    var env = args.ElementAtOrDefault(0) ?? "all";
    var app = Flag(args, "--app");
    var tipo = Flag(args, "--tipo");
    var asJson = HasFlag(args, "--json");
    var withApplied = HasFlag(args, "--applied");

    var cfg = LoadConfig();
    var scriptsRoot = FindScriptsRoot();
    var envs = env == "all" ? cfg.Environments.Keys.ToList() : new List<string> { env };
    var envNames = cfg.Environments.Keys.ToHashSet(StringComparer.OrdinalIgnoreCase);

    var allItems = new List<(string Env, string Db, string App, string Tipo, string Id, bool Applied)>();

    foreach (var envName in envs)
    {
        var dbs = cfg.GetDbs(envName);
        var pendingByDb = new List<(string Db, string App, string Tipo, string Id, bool Applied)>();

        foreach (var (db, connString) in dbs)
        {
            var upgrader = BuildUpgrader(connString, scriptsRoot, db, envName, app, tipo, cfg, silent: true);
            var scriptsToExecute = upgrader.GetScriptsToExecute();

            foreach (var s in scriptsToExecute)
            {
                var parsed = ParseScriptPath(s.Name, envNames);
                var tipoLabel = parsed.Applied.Length > 0
                    ? $"{parsed.Familia}@{string.Join(",", parsed.Applied)}"
                    : parsed.Familia;
                pendingByDb.Add((db, parsed.App, tipoLabel, parsed.Id, false));
                allItems.Add((envName, db, parsed.App, tipoLabel, parsed.Id, false));
            }

            if (withApplied)
            {
                foreach (var name in GetAppliedScripts(connString))
                {
                    var parsed = ParseScriptPath(name, envNames);
                    if (parsed.App == "?") continue;
                    var tipoLabel = parsed.Applied.Length > 0
                        ? $"{parsed.Familia}@{string.Join(",", parsed.Applied)}"
                        : parsed.Familia;
                    allItems.Add((envName, db, parsed.App, tipoLabel, parsed.Id, true));
                }
            }
        }

        if (!asJson)
        {
            var label = withApplied ? "=== En {envName} ===" : $"=== Pendientes en {envName} ===";
            Console.WriteLine($"\n{label}");
            if (pendingByDb.Count == 0 && !withApplied)
            {
                Console.WriteLine("  (sin pendientes — todo aplicado)");
            }
            else
            {
                foreach (var g in pendingByDb.GroupBy(p => p.Db))
                {
                    Console.WriteLine($"\n  [{g.Key}]");
                    foreach (var p in g)
                        Console.WriteLine($"    [{(p.Applied ? "x" : " ")}] {p.Id,-40} {p.App}/{p.Tipo}");
                }
            }
        }
    }

    if (asJson)
    {
        Console.WriteLine(JsonSerializer.Serialize(allItems.Select(p => new
        {
            env = p.Env, db = p.Db, app = p.App, tipo = p.Tipo, id = p.Id, applied = p.Applied
        }), JsonOpts()));
    }
    return 0;
}

static int Apply(string[] args)
{
    var env = args.ElementAtOrDefault(0) ?? "dev";
    var app = Flag(args, "--app");
    var tipo = Flag(args, "--tipo");
    var id = Flag(args, "--id");
    var force = HasFlag(args, "--force");

    var cfg = LoadConfig();
    var scriptsRoot = FindScriptsRoot();
    var dbs = cfg.GetDbs(env);

    var overallSuccess = true;
    var anyScheduled = false;
    var executedFiles = new List<string>();
    foreach (var (db, connString) in dbs)
    {
        if (force && id != null)
            RemoveFromJournal(connString, id);

        var upgrader = BuildUpgrader(connString, scriptsRoot, db, env, app, tipo, cfg, id,
            executedFiles: executedFiles);

        var pendingCount = upgrader.GetScriptsToExecute().Count;
        if (pendingCount == 0)
            continue;
        anyScheduled = true;

        Console.WriteLine($"\n=== {db} ({env}) ===");
        var result = upgrader.PerformUpgrade();

        if (!result.Successful)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"  FAIL: {result.Error.Message}");
            Console.ResetColor();
            overallSuccess = false;
            break;  
        }
    }

    if (id != null && !anyScheduled)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"  FAIL: no se ejecutó ningún script con --id '{id}' en {env}. Revisa el id o el routing.");
        Console.ResetColor();
        return 1;
    }

    if (!overallSuccess)
    {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"\nMigración abortada con errores en {env}.");
        Console.ResetColor();
        return 1;
    }

    foreach (var file in executedFiles.Distinct(StringComparer.OrdinalIgnoreCase))
    {
        var (family, applied) = ParseSuffix(file);
        if (family == null || applied.Contains(env, StringComparer.OrdinalIgnoreCase))
            continue;
        var newFile = Path.Combine(
            Path.GetDirectoryName(file)!,
            Path.GetFileNameWithoutExtension(file) + "." + env + ".sql");
        File.Move(file, newFile);
        Console.WriteLine($"  marcado como aplicado en {env}: {Path.GetFileName(newFile)}");
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

static UpgradeEngine BuildUpgrader(string connString, string scriptsRoot,
    string db, string env, string? appFilter, string? tipoFilter, Config cfg, string? idFilter = null,
    bool silent = false, List<string>? executedFiles = null)
{
    var appFolders = cfg.GetAppFolders(db, appFilter, scriptsRoot);  

    var options = new FileSystemScriptOptions
    {
        IncludeSubDirectories = true,
        Extensions = new[] { "*.sql" },
        Encoding = System.Text.Encoding.UTF8,
        Filter = path =>
        {
            if (!appFolders.Any(af => path.StartsWith(af, StringComparison.OrdinalIgnoreCase)))
                return false;
            var (family, applied) = ParseSuffix(path);
            if (family == null)
                return false;
            if (family != "*" && !db.StartsWith(family, StringComparison.OrdinalIgnoreCase))
                return false;
            if (applied.Contains(env, StringComparer.OrdinalIgnoreCase))
                return false;
            if (tipoFilter != null && !path.Contains($"\\{tipoFilter}\\") && !path.Contains($"/{tipoFilter}/"))
                return false;
            if (idFilter != null)
            {
                var idClean = Path.GetFileNameWithoutExtension(idFilter);
                var name = Path.GetFileNameWithoutExtension(Path.GetFileNameWithoutExtension(path));
                var nameCore = name.Split('.')[0];   
                if (nameCore != idClean && !name.StartsWith(idClean + ".", StringComparison.OrdinalIgnoreCase))
                    return false;
            }
            executedFiles?.Add(path);
            return true;
        }
    };

    var builder = DeployChanges.To
        .SqlDatabase(connString)
        .WithScripts(new FileSystemScriptProvider(scriptsRoot, options))
        .JournalToSqlTable("app", "SchemaVersions")
        .WithTransactionPerScript()
        .WithExecutionTimeout(TimeSpan.FromMinutes(10));

    return (silent
        ? builder.LogTo(new NoOpUpgradeLog())
        : builder.LogToConsole()).Build();
}

static (string? Family, string[] Applied) ParseSuffix(string path)
{
    var fileName = Path.GetFileNameWithoutExtension(path);
    var firstDot = fileName.IndexOf('.');
    if (firstDot < 0) return (null, Array.Empty<string>());
    var segs = fileName[(firstDot + 1)..].Split('.');
    if (segs.Length == 0) return (null, Array.Empty<string>());
    return (segs[0], segs.Skip(1).ToArray());
}

static (string App, string Id, string Familia, string[] Applied) ParseScriptPath(
    string scriptName, HashSet<string> envNames)
{
    var noExt = scriptName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase)
        ? scriptName[..^4] : scriptName;
    var segs = noExt.Split('.');
    if (segs.Length < 3) return ("?", scriptName, "", Array.Empty<string>());

    var applied = new List<string>();
    var cursor = segs.Length - 1;
    while (cursor > 0 && envNames.Contains(segs[cursor]))
    {
        applied.Insert(0, segs[cursor]);
        cursor--;
    }
    if (cursor < 1) return ("?", scriptName, "", Array.Empty<string>());

    var familia = segs[cursor];
    cursor--;
    var id = string.Join(".", segs, 1, cursor);            
    return (segs[0], id, familia, applied.ToArray());
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
    }
    return applied;
}

static int RemoveFromJournal(string connString, string id)
{
    try
    {
        using var conn = new SqlConnection(connString);
        conn.Open();
        using var cmd = new SqlCommand(
            "DELETE FROM app.SchemaVersions WHERE ScriptName LIKE '%' + @id + '%'",
            conn);
        cmd.Parameters.Add(new SqlParameter("@id", id));
        return cmd.ExecuteNonQuery();
    }
    catch
    {
        return 0;
    }
}

static Config LoadConfig()
{
    var configPath = Environment.GetEnvironmentVariable("MIGRATIONS_CONFIG_PATH")
        ?? Path.Combine(AppContext.BaseDirectory, "migrations.config.json");
    var json = File.ReadAllText(configPath);
    return JsonSerializer.Deserialize<Config>(json, JsonOpts()) ?? throw new("Invalid config");
}

static string FindScriptsRoot()
{
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

static JsonSerializerOptions JsonOpts() => new() { PropertyNameCaseInsensitive = true };

class Config
{
    public Dictionary<string, Dictionary<string, string>> Environments { get; set; } = new();
    public string[] Routing { get; set; } = Array.Empty<string>();

    public Dictionary<string, string> GetDbs(string env)
    {
        if (!Environments.TryGetValue(env, out var dbs) || dbs.Count == 0)
            throw new($"Ambiente '{env}' no definido o vacío en migrations.config.json");
        return dbs;
    }

    public List<string> GetAppFolders(string db, string? appFilter, string scriptsRoot)
    {
        var root = scriptsRoot;
        var folders = new List<string>();

        var allApps = Directory.GetDirectories(root).Select(d => Path.GetFileName(d)).ToList();
        foreach (var appName in allApps)
        {
            if (appFilter != null && !string.Equals(appName, appFilter, StringComparison.OrdinalIgnoreCase))
                continue;

            if (!Routing.Contains(appName, StringComparer.OrdinalIgnoreCase))
                continue;

            folders.Add(Path.Combine(root, appName));
        }
        return folders;
    }
}
