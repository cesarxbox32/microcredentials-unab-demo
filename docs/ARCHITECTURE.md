# Arquitectura

El navegador ejecuta el motor TypeScript y almacena escenarios ficticios localmente. El backend de laboratorio expone un motor Python por REST, persistencia independiente y una frontera de integración. La regla de negocio evita asignar a una persona dos cupos o entregar un cupo sin evidencia de capacidad disponible.

```mermaid
flowchart LR
    Pages[GitHub Pages] --> UI[React y Recharts]
    UI --> TS[Motor TypeScript]
    TS --> LS[(Persistencia IndexedDB)]
    Client[Cliente de laboratorio] --> API[FastAPI y Pydantic]
    S[APScheduler] --> PY[Motor Python]
    API --> PY
    PY --> DB[(SQLAlchemy y SQLite)]
    PY --> Mock[Proveedor simulado]
    subgraph Adaptadores preparados
      Graph[Microsoft Graph]
      Coursera[Coursera API]
    end
```

## Asignación

```mermaid
flowchart TD
    A[Ordenar candidatos elegibles] --> B{Capacidad confirmada}
    B -- No --> C[Esperar y auditar]
    B -- Sí --> D[Reservar cupo e invitar]
    D --> E{Aceptación confirmada}
    E -- No --> F[Mantener reserva]
    E -- Sí --> G[Activar membresía e iniciar seguimiento]
```

## Liberación y reconciliación

```mermaid
flowchart TD
    A[Evidencia de certificado] --> B{Política, gracia y aprobación}
    B -- Cumple --> C[Solicitar eliminación de membresía]
    B -- No cumple --> X[Conservar asignación y registrar motivo]
    C --> D[Pendiente de reconciliación]
    D --> E{Capacidad contractual confirmada}
    E -- No --> D
    E -- Sí --> F[Disponible para reasignación]
```

## Rotación FIFO y cohortes

```mermaid
flowchart LR
    A[Prioridad justificada] --> B[Fecha de ingreso]
    B --> C[ID como desempate]
    C --> D[Primer estudiante elegible]
    D --> E[Cupo reconciliado]
```

```mermaid
flowchart LR
    A[Tramo 1 · 200] --> B{Evidencia, calendario y política}
    B --> C[Tramo 2 · 200]
    C --> D{Evidencia, calendario y política}
    D --> E[Tramo 3 · 100]
```

## Entra ID y Coursera

```mermaid
sequenceDiagram
    participant E as Entra ID
    participant G as Microsoft Graph
    participant I as Identity Manager
    participant P as Coursera
    I->>E: OAuth 2.0 de aplicación autorizada
    I->>G: Consultar miembros de grupo permitido
    G-->>I: ID de objeto, correo, UPN y estado
    I->>I: Validar dominio y revisar correspondencias
    Note over E,P: SSO institucional se configura por separado
    I-->>P: Derivar solicitud de invitación autorizada
    P-->>I: Estado de invitación o membresía
```

## Estados

```mermaid
stateDiagram-v2
    state Estudiante {
      [*] --> Espera
      Espera --> Invitado
      Invitado --> Activo
      Activo --> EnProgreso
      EnProgreso --> CursoCompletado
      CursoCompletado --> CertificacionPendiente
      CertificacionPendiente --> Certificado
      Certificado --> LiberacionPendiente
      LiberacionPendiente --> Finalizado
    }
    state Licencia {
      [*] --> Disponible
      Disponible --> Reservada
      Reservada --> Asignada
      Asignada --> PendienteLiberacion
      PendienteLiberacion --> LiberacionEnProceso
      LiberacionEnProceso --> PendienteReconciliacion
      PendienteReconciliacion --> Reasignable
      Reasignable --> Reservada
      Asignada --> Vencida
    }
    state Membresia {
      [*] --> SinMembresia
      SinMembresia --> InvitacionPendiente
      InvitacionPendiente --> Vigente
      Vigente --> Eliminada
    }
```

## Modelo entidad-relación

```mermaid
erDiagram
    COHORTE ||--o{ ESTUDIANTE : agrupa
    ESTUDIANTE o|--o| LICENCIA : ocupa
    POLITICA ||--o{ LICENCIA : limita
    ESTUDIANTE ||--o{ OPERACION : referencia
    LICENCIA ||--o{ OPERACION : referencia
    ESTUDIANTE ||--o{ NOTIFICACION : recibe
    CURSO ||--o{ ESTUDIANTE : asignado
```

En SQLite se persisten política, estudiantes, licencias y operaciones. Las referencias de auditoría se registran en JSON por transición. Cohortes configurables, cursos y notificaciones residen en el motor del navegador. El acceso al backend se serializa mediante actualización de la fila de política. Para operación institucional se requiere un modelo con contratos y proveedores independientes, historial de asignaciones, restricciones de base de datos y un trabajador durable. [Requisitos de producción](PRODUCTION_REQUIREMENTS.md)
