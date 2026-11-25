# Despliegue

## Subir a GitHub

El remoto de destino es `https://github.com/cesarxbox32/microcredentials-unab.git`. Para subir desde Codex, instala o reconfigura la integración de GitHub para que tenga acceso explícito a ese repositorio. La credencial necesita permisos de escritura en `Contents` y `Workflows`. La integración puede enumerar metadata del repositorio una vez autorizado.

Si prefieres subir desde tu terminal, autentícate con GitHub CLI como `cesarxbox32` y comprueba el acceso antes de publicar.

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh api repos/cesarxbox32/microcredentials-unab --jq '.permissions.push'
git remote -v
git ls-remote --symref origin HEAD refs/heads/main
git push -u origin main
```

Ejecuta el último comando cuando `permissions.push` indique `true` y el remoto esté vacío o su historial sea compatible con tu rama. Si `main` ya tiene commits, revisa e integra los cambios remotos antes de subir. Mantén las credenciales dentro del flujo de autenticación de GitHub.

## GitHub Pages

En un repositorio privado de cuenta personal, GitHub Pages requiere un plan compatible, como GitHub Pro. Revisa la visibilidad de Pages antes del despliegue. El sitio estático puede ser público aunque el código esté en un repositorio privado. [Acerca de GitHub Pages](https://docs.github.com/pages/getting-started-with-github-pages/about-github-pages)

1. Abrir **Settings → Pages**. En **Build and deployment → Source**, elegir **GitHub Actions**.
2. Abrir **Actions → CI y GitHub Pages → Run workflow**, seleccionar `main` y ejecutar el flujo si el primer intento se hizo antes de activar Pages.
3. Verificar los trabajos `frontend`, `backend` y `deploy`. Si el sitio es público, probarlo en un navegador sin autenticación y recargar la vista `#simulador`. La URL esperada es `https://cesarxbox32.github.io/microcredentials-unab/`.

Si Pages no está disponible para el plan, ejecuta `npm ci` y `npm run build` en `frontend` y sirve `dist/` en un alojamiento estático autorizado.

Vite usa base relativa. La navegación por fragmentos mantiene la misma ruta HTTP al recargar una sección. GitHub Pages recibe únicamente el directorio compilado `frontend/dist`. [Configuración de Pages](https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Laboratorio local

```bash
cp .env.example .env
docker compose up --build
```

Configura tokens locales generados aleatoriamente antes de probar operaciones desde Swagger. Demo en `http://127.0.0.1:8080`. API en `http://127.0.0.1:8000/docs`. SQLite se guarda en el volumen `database`. Para ejecución sin Docker, sigue las instrucciones del README.

## Distribución institucional futura

Separar laboratorio, preproducción y producción. Desplegar API y trabajador privado en un servicio autorizado, como Azure Container Apps, con PostgreSQL administrado y Key Vault. Usar migraciones, backups, alertas y una sola coordinación durable del scheduler. Validar despliegue y recuperación en un ambiente aislado. [Requisitos](PRODUCTION_REQUIREMENTS.md)
