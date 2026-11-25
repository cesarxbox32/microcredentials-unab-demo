# Informe final de MicroCred Manager

**César Villablanca — Ingeniero en Computación e Informática**
**24 de noviembre de 2026**

## Operación verificada

La demo estática funciona con datos ficticios y persistencia transaccional en IndexedDB. Incluye panel ejecutivo, registro, inventario, cohortes, cola, cursos, automatizaciones, integraciones, auditoría, configuración, notificaciones y simulador. El año simulado alcanza 500 accesos con 300 transferencias bajo el convenio hipotético. El escenario del 10% alcanza 220 accesos y bloquea nuevas transferencias.

FastAPI ofrece una API de laboratorio con persistencia SQLite, roles, Swagger, auditoría, claves de idempotencia y scheduler opcional. El motor descuenta transferencias y exige reconciliación antes de reasignar. Vetar el uso real es la configuración predeterminada. [Arquitectura](docs/ARCHITECTURE.md)

Se ejecutaron 10 pruebas de Vitest, 5 de Pytest y 3 de Playwright. Lint, TypeScript, build y validación de Compose terminaron correctamente. También se verificó el arranque de Nginx y FastAPI con Docker Compose. [Resultados y alcance](docs/TEST_RESULTS.md)

## Datos ficticios e integraciones preparadas

La demo genera identidades, matrículas, avance, certificados y correos locales. Los adaptadores Python preparan consultas documentadas de Coursera, sincronización acotada de Graph y la llamada de envío de correo. Las escrituras Coursera, la confirmación real de capacidad y la vinculación persistente de identidades requieren completar el piloto institucional. [Coursera](docs/COURSERA_INTEGRATION.md) · [Entra ID](docs/MICROSOFT_ENTRA_INTEGRATION.md)

## Pendientes para operación institucional

Validar convenio, grupos y dominios, permisos Graph, evidencia de certificación, capacidad reportada y seguridad. Incorporar identidad productiva, migraciones PostgreSQL y un mecanismo durable para coordinar acciones externas y sus reintentos. [Requisitos](docs/PRODUCTION_REQUIREMENTS.md)

## Publicación

El repositorio remoto indicado es `cesarxbox32/microcredentials-unab`. El workflow prepara la publicación del frontend en la subruta del repositorio. Verificar permisos de código y workflows antes de subir y confirmar después el SHA de `main` y el resultado de Pages. [Pasos de despliegue](docs/DEPLOYMENT.md)
