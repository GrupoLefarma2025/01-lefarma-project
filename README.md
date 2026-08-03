# Lefarma — CI/CD y Deploys

Cómo se build-ea, versiona y publica cada ambiente. Todo lo de aquí vive en
`.github/workflows/`, `multiappcli.ps1` y `deploy/lefarma-autodeploy.ps1`.

## Panorama

```
develop ──PR──▶ staging ──merge──▶ PRE-RELEASE v<VERSION-STAGING> (zip qa)
                                          │
                                          ▼  (servidor 192.168.4.2, cada 5 min)
                                     D:\Desarrollo-pruebas-base  (staging)

staging ──PR──▶ main ──tag v*──▶ RELEASE ESTABLE v<tag> (zip prod)
                                          │
                                          ▼  (autodeploy, cuando se configure $Targets.prod)
                                     carpeta IIS de produccion
```

Regla de oro: **los pre-releases (tag con guion, ej. `v1.1.0-rc.2`) jamás tocan
producción**; solo los tags estables (`v1.1.0`) disparan el release de producción.

## Versiones (archivos en la raíz)

| Archivo | Ambiente | Quién lo edita |
|---|---|---|
| `VERSION-STAGING` | staging | tú, en cada PR (ej. `1.1.0-rc.1` → `1.1.0-rc.2`). El tag será `v<contenido>` |
| `VERSION` | producción | tú; es la base. El tag estable lo creas a mano |

Si mergeas a staging sin bump-ear `VERSION-STAGING`, el workflow falla a
propósito ("tag ya existe"): es el recordatorio de subir el número.

## Staging (automático)

1. PR hacia `staging`, merge.
2. Workflow **Staging pre-release**: `npm ci` + `multiappcli build:qa` → crea el
   pre-release `v<VERSION-STAGING>` con `lefarma-qa.zip`. **El zip lo sube el
   workflow**, nadie lo sube a mano.
3. En el servidor, `lefarma-autodeploy.ps1` (Scheduled Task cada 5 min) compara
   el último pre-release contra `state\last-qa.txt`; si es nuevo: descarga,
   `app_offline.htm` (apaga solo esa app), robocopy sobre
   `D:\Desarrollo-pruebas-base`, recycle de IIS.
4. Verificación: el login muestra la versión y `GET /api/version` la confirma.

Corrida silenciosa del autodeploy = no hay nada nuevo (no re-depliega).

## Producción (tag = decisión humana)

1. PR de `staging` → `main`, merge. (El merge a main NO build-ea producción.)
2. ```
   git checkout main && git pull
   git tag v1.1.0
   git push origin v1.1.0
   ```
3. Workflow **Release** (trigger: tags `v*` sin guion): build prod → crea el
   Release `v1.1.0` con `lefarma-prod.zip` y notas automáticas. El zip lo sube
   el workflow al Release de tu tag.
4. El autodeploy lo publicará cuando `$Targets.prod` tenga el path de IIS
   (hoy está vacío a propósito; usa `state\last-prod.txt` como memoria).

Los zips excluyen `appsettings*.json` y `web.config`: al descomprimir sobre el
sitio, la configuración del servidor queda intacta.

## Variables de build del frontend

- `VITE_API_URL`, `VITE_APP_NAME`, `BASE_URL_PATH`: viven en **GitHub →
  Settings → Secrets and variables → Actions → Environments** (`staging` y
  `production`, 3 variables cada uno). Los workflows las inyectan con
  `environment:` + `vars.*`. No van en el repo (`.env.staging` está gitignoreado).
- `VITE_APP_VERSION`: no se configura en ningún lado — la inyecta
  `vite.config.ts` desde `VERSION` / `VERSION-STAGING` en cada build. El backend
  hace lo mismo vía `Lefarma.API.csproj` (`/api/version`).

## Deploy manual (multiappcli)

```
.\multiappcli.ps1 publish:qa    build qa + SSH al servidor + deploy a staging
.\multiappcli.ps1 publish       build prod + SSH (produccion: pendiente de configurar)
```

## Lado del servidor (192.168.4.2)

```
C:\LefarmaDeploy\
├── lefarma-autodeploy.ps1   el poller (Scheduled Task "Lefarma AutoDeploy", 5 min)
├── .token                   PAT fine-grained (Contents read-only), solo Administradores
├── remote-deploy.ps1        helper que sube multiappcli en publish manual
├── state\last-qa.txt        ultimo pre-release desplegado
├── state\last-prod.txt      ultimo release estable desplegado
└── autodeploy.log           bitacora (NUEVO x / OK x / ERROR x)
```
