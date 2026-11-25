# Propuesta ejecutiva

**MicroCred Manager**
**César Villablanca — Ingeniero en Computación e Informática**

La asignación inicial cubre 200 de 500 estudiantes. La rotación manual exige comprobar evidencia, coordinar aprobaciones y confirmar que los cupos vuelven al inventario antes de invitar a los siguientes participantes. Una demora entre esos pasos prolonga el tiempo de espera y puede desaprovechar capacidad.

Proponemos un inventario auditable con validación contractual previa, estrategias alternativas y seguimiento de certificaciones. El motor puede reservar e invitar según una cola verificable, preservar cupos ante invitaciones pendientes y detener transferencias cuando se agota el presupuesto. La simulación permite evaluar el impacto de la frecuencia de revisión y de la duración de cursos con métricas reproducibles. La reducción de horas de trabajo requiere una medición de línea base en el piloto.

En el ejemplo hipotético, 300 transferencias habilitan 500 accesos. Si aplica un límite del 10%, 200 licencias admiten 20 transferencias en el período de ejemplo. La licencia transferida puede afectar el acceso del estudiante a cursos y la disponibilidad contractual debe confirmarse con el proveedor. [Acuerdo general de Coursera](https://www.coursera.org/about/terms-for-enterprise)

## Plan de implementación

1. Validar términos, criterios de certificación, consentimientos, grupos piloto y alcance de API.
2. Probar lectura de identidades y reportes con cuentas autorizadas. Conciliar manualmente capacidad y estado académico.
3. Ejecutar un piloto supervisado con un grupo acotado. Medir espera, ocupación, errores y esfuerzo por operación.
4. Aprobar ampliación gradual tras revisar resultados. Separar contratos por proveedor, particionar trabajos, usar PostgreSQL y aplicar observabilidad y auditoría central.
