# Resultados de pruebas

Ejecución local del 24 de noviembre de 2026 con Node 24, Python 3.12, SQLite y Chromium. Playwright usó el frontend compilado servido bajo `/microcredentials-unab/`, con archivos estáticos y navegación por fragmentos.

| Verificación | Resultado comprobado |
| --- | --- |
| `npm run lint` | Exit 0. |
| `npm run build` | TypeScript y compilación Vite con exit 0. |
| `npm test` | 10 pruebas aprobadas. Incluye caso de 5.000 estudiantes con 1.000 licencias. |
| `python -m pytest -q` | 5 pruebas aprobadas. Dos advertencias de deprecación del runner y TestClient en este entorno. |
| `MICROCRED_CHROMIUM=/usr/bin/chromium npm run test:e2e` | 3 recorridos aprobados sobre la compilación de producción. |
| `docker compose config -q` | Exit 0. Se construyeron ambas imágenes y se comprobó que Nginx sirve la demo y que FastAPI devuelve HTTP 200 en `/health`. La prueba usó puertos alternativos y el certificado del proxy como secreto temporal de BuildKit. |

## Cobertura verificada

- 500 estudiantes, 200 cupos y 300 personas en espera al inicio. Cohortes de 200, 200 y 100.
- Reasignación individual tras certificación, período de gracia y aprobación. Tres tramos completados en el escenario hipotético.
- Límite de 20 transferencias y 220 accesos bajo el convenio del 10%. Pruebas de no duplicación, no liberación prematura e invitación pendiente.
- Pruebas de concurrencia con SQLite, idempotencia, dry-run, errores de proveedor y recuperación sin repetir una eliminación ya registrada.
- Persistencia después de recargar, importación y deduplicación CSV, exportación protegida, navegación móvil y modo oscuro.
- Recorrido de alta de cohorte, prioridad, historial, detalle, suspensión, aprobación, integración ficticia, bandeja y controles del simulador.

La prueba de escala ejecuta el motor TypeScript en memoria. Los conectores se probaron con transportes HTTP simulados. PostgreSQL, usuarios institucionales y dispositivos físicos requieren validación por separado. [Captura del dashboard](screenshots/dashboard.png) · [Captura del simulador](screenshots/simulator.png)
