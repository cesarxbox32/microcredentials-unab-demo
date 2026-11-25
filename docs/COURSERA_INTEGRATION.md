# Coursera for Campus y Business API

La oferta Campus contempla capacidades de administración académica e inicio de sesión único según el plan. La guía de API incluye clientes Business, Campus y Government. Solicitar acceso al Developer Portal, registrar una aplicación para la organización autorizada y confirmar con el representante de Coursera los productos habilitados, cuotas, filtros y permisos por ruta. [Comparación de planes Campus](https://www.coursera.org/campus/compare-plans/) · [Portal de desarrolladores](https://dev.coursera.com/) · [Guía oficial de inicio](https://dev.coursera.com/get-started)

## Rutas verificadas en documentación pública

Base de API empresarial `https://api.coursera.com/ent/api/businesses.v1/{orgId}`. La API documenta OAuth 2.0 Bearer para las rutas empresariales. Los permisos institucionales se deben verificar con la aplicación y la organización piloto. La tabla documenta rutas, sin afirmar acceso autenticado.

| Método y ruta | Función y límite |
| --- | --- |
| `POST /oauth2/client_credentials/token` en `https://api.coursera.com` | Basic Auth con clave y secreto, cuerpo URL-encoded con `grant_type=client_credentials`. [OAuth](https://dev.coursera.com/docs/oauth-credentials/1/routes/oauth2/client_credentials/token/post) |
| `GET /programs` | Listar programas de la organización. [Get Started](https://dev.coursera.com/get-started) |
| `GET /users` | Listar usuarios de la organización, paginado. [Referencia Business API](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/401_Unauthorized) |
| `GET /programs/{programId}/invitations` | Consultar invitaciones pendientes, paginado. [Referencia](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/Fault) |
| `POST /programs/{programId}/invitations` | Invitar mediante identificador externo y opción `sendEmail`. Escritura pendiente de piloto. [Referencia](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/Fault) |
| `GET /programs/{programId}/memberships` y `GET /programs/{programId}/memberships/{programId~externalId}` | Listar miembros o consultar una membresía. [Referencia](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/401_Unauthorized) |
| `POST /programs/{programId}/memberships` | Requiere cuenta existente de Coursera. [Creación de membresía](https://dev.coursera.com/docs/coursera-for-business-api-product/1/routes/api%2Fbusinesses.v1%2F%7BorgId%7D%2Fprograms%2F%7BprogramId%7D%2Fmemberships/post) |
| `GET /programs/{programId}/programEnrollments/{external_id~content_type~content_id}` y `POST /programs/{programId}/programEnrollments` | Consultar inscripción individual o inscribir. La escritura requiere cuenta y membresía vigente. [Referencia](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/401_Unauthorized) |
| `GET /enrollmentReports` | Reporte por organización. Interpretar el estado semántico de finalización. Puede haber curso completado con menos del 100% de progreso. Si la fila trae `contentCertificateUrl`, puede tratarse como evidencia según la regla académica aprobada. [Reporte](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/EnrollmentReport) · [Campos de progreso](https://dev.coursera.com/docs/coursera-for-business-api-product/1/types/LearnerProfileStandardFields) |
| `DELETE /programs/{programId}/memberships/{programId~externalId}` | Usar el ID devuelto por la lista de membresías. Reingresar requiere una nueva invitación. Escritura pendiente de piloto. [Eliminación](https://dev.coursera.com/docs/coursera-for-business-api-product/1/routes/api/businesses.v1/%7BorgId%7D/programs/%7BprogramId%7D/memberships/%7BprogramId~externalId%7D/delete) |

## Ciclo de invitación y recuperabilidad

La reserva se crea antes de invitar. El estudiante recibe instrucciones, crea o vincula una cuenta, acepta y activa la membresía. Una inscripción a un curso es una acción posterior. Para reconciliar se requieren evidencias de alcance del cambio, disponibilidad efectiva y consumo contractual. El conector HTTP expone consultas de primera página. Antes de producción exige implementar paginación y filtros confirmados, validar los campos de respuesta y acordar frecuencia de polling. La PoC deja capacidad contractual, escrituras e interpretación de ausencia de certificados como pasos supervisados. La evidencia de certificado disponible en el reporte se trata como referencia sensible.

Los términos generales vigentes desde el 17 de diciembre de 2025 establecen un límite del 10% de licencias compradas por período de 12 meses contado desde el inicio de licencia. También prevén pérdida de acceso a cursos tras una transferencia, salvo otra inscripción pagada. El convenio particular de la UNAB sigue sin verificarse. El escenario de 300 transferencias es hipotético. [Acuerdo general](https://www.coursera.org/about/terms-for-enterprise)

El plan productivo debe validar SAML, mapeo del identificador externo y opciones de aprovisionamiento con Coursera antes del piloto. [Integraciones empresariales](https://www.coursera.org/business/integrations)
