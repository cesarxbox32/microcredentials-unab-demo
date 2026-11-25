# Modelo de negocio y reglas de asignación

| Variable | Escenario hipotético | Escenario restrictivo |
| --- | ---: | ---: |
| Capacidad contratada simultánea | 200 | 200 |
| Estudiantes registrados | 500 | 500 |
| Transferencias disponibles | 300 | 20 |
| Cobertura máxima en el escenario | 500 | 220 |

El máximo se calcula como el menor valor entre el tope absoluto y el porcentaje aplicado a la capacidad contratada, redondeado hacia abajo. Una invitación reserva capacidad. La cobertura registra estudiantes que aceptaron y activaron membresía. La proyección del dashboard expresa un techo por capacidad y presupuesto de transferencias. La comparación del simulador calcula cobertura efectiva bajo el horizonte y la duración configurados.

El motor reserva en orden de prioridad académica justificada, día de ingreso e identificador. En modo cohortes exige la apertura del tramo, sus fechas, su capacidad y, para liberación, el cierre académico del tramo saliente. El período de gracia y la aprobación supervisada condicionan la rotación. La duración máxima genera una alerta para revisión y nunca reemplaza la evidencia de certificación. La comparación manual representa una revisión periódica cada 30 días, no horas de trabajo estimadas.

Los certificados son evidencias ficticias. El curso termina primero y la simulación registra certificación en un paso posterior. En el proceso real, el proveedor debe confirmar por separado la capacidad efectiva y cualquier impacto sobre el acceso del estudiante. [Términos generales de Coursera](https://www.coursera.org/about/terms-for-enterprise)
