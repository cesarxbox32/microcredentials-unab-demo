# Requisitos de producción

| Área | Evidencia de aceptación |
| --- | --- |
| Gobierno y cumplimiento | Contrato y pedido validados, base legal, alcance y retención aprobados, tratamiento de datos y encargados documentados. |
| Coursera | Acceso autorizado, paginación, piloto con credenciales autorizadas, equivalencia de estados comprobada, reglas de certificado y reconciliación real acordadas. |
| Microsoft Entra ID | Aplicación registrada, grupos y dominios permitidos, consentimiento mínimo, SAML validado con Coursera y roles de plataforma mediante OIDC. |
| Correo | Aplicación separada y buzón limitado, plantillas, destinatarios, reintentos, seguimiento y protección ante envíos duplicados. |
| Persistencia | Migraciones y pruebas PostgreSQL, aislamiento por contrato y proveedor, backups, restauración, conservación de evidencias. |
| Operaciones externas | Outbox transaccional, claves estables junto al proveedor, política para resultados ambiguos, límites de reintento y trazabilidad de aprobación. |
| Rendimiento | Medir escenarios de miles de estudiantes, carga de reportes y tasas límite del proveedor. |
| Monitoreo | Métricas, alertas de latencia y fallos, fallos de conciliación, responsable y procedimiento de intervención. |

La API disponible es una base de laboratorio. El backend todavía requiere el calendario y las reglas detalladas del motor del navegador, gestión durable de cohortes, sincronización y vinculación persistente de identidades, plantillas de Graph y procesamiento de trabajos externos. Las escrituras en Coursera permanecen como acciones institucionales pendientes. La recuperación después de un fallo ambiguo de escritura requiere confirmación del proveedor y revisión humana.
