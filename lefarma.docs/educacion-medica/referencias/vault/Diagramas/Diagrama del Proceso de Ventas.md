---
codigo: "ASK-VEN-DPD-001"
version: "01"
fecha: "24-jun-2021"
area: "Ventas IMSS"
tipo: "Diagrama"
aliases:
  - Diagrama del Proceso de Ventas
---

# Diagrama del Proceso de Ventas

> Código: [[Proceso de Ventas IMSS|ASK-VEN-DPD-001]] · Versión: 01 · Fecha: 24-jun-2021
> Proceso: Ventas · Área: Comercial

Diagrama de proceso y documentación del proceso de Ventas IMSS. Forma parte del proceso general documentado en [[Proceso de Ventas IMSS]].

## Etapas del proceso

1. **Planea** (mensualmente)
2. **Ejecuta** (visita por unidad médica)
3. **Verifica** (reporte semanal)
4. **Mejora** (semanal y mensual)

## Responsables

| Abrev. | Responsable |
|--------|-------------|
| [[Roles y Abreviaturas\|DC]] | Director Corporativo |
| [[Roles y Abreviaturas\|GG]] | Gerente General Asokam |
| [[Roles y Abreviaturas\|GV-IMSS]] | Gerente de Ventas IMSS |
| [[Roles y Abreviaturas\|GRI]] | Gerente de Relaciones Institucionales |
| [[Roles y Abreviaturas\|EV-IMSS]] | Ejecutivo de Ventas |
| [[Roles y Abreviaturas\|EE]] | Ejecutivo Estadístico |
| [[Roles y Abreviaturas\|CA]] | Coordinador Administrativo |
| [[Roles y Abreviaturas\|M-GPS]] | Monitorista GPS |
| [[Roles y Abreviaturas\|EP]] | Especialista de Producto |
| [[Roles y Abreviaturas\|CQ]] | Control de Quejas |
| [[Roles y Abreviaturas\|TECNO]] | Tecnovigilancia |

## Documentos relacionados

| Código | Tipo | Nombre |
|--------|------|--------|
| LEF-CAL-PNO-003 | Procedimiento Normalizado Operativo | PNO del proceso de quejas |
| [[Elaborar Plan de Trabajo\|ASK-VEN-IDT-001]] | Instructivo de trabajo | [[Elaborar Plan de Trabajo]] |
| [[Visitar Unidades Médicas del IMSS\|ASK-VEN-IDT-002]] | Instructivo de trabajo | [[Visitar Unidades Médicas del IMSS]] |
| [[Recabar Información e Indicadores de Ventas IMSS\|ASK-VEN-IDT-003]] | Instructivo de trabajo | [[Recabar Información e Indicadores de Ventas IMSS]] |
| [[ASK-VEN-FOR-001 Metas de Ventas y Desplazamiento\|ASK-VEN-FOR-001]] | Formato | [[ASK-VEN-FOR-001 Metas de Ventas y Desplazamiento]] |
| [[ASK-VEN-FOR-002 Plan de Trabajo (formato)\|ASK-VEN-FOR-002]] | Formato | Distribución del presupuesto |
| [[ASK-VEN-FOR-003 Reporte de Visitas Médicas\|ASK-VEN-FOR-003]] | Formato | [[ASK-VEN-FOR-003 Reporte de Visitas Médicas]] |
| [[ASK-ADM-FOR-001 Solicitud de Viáticos\|ASK-ADM-FOR-001]] | Formato | Solicitud de viáticos |
| [[ASK-VEN-DOE-001 Reporte de Incidente\|ASK-VEN-DOE-001]] | Formato | Reporte de incidente |

## Diagrama de flujo

```mermaid
flowchart TD
    INICIO([INICIO])

    subgraph E1 [Etapa 1 · Planea mensualmente]
        P1["GV-IMSS: Informa y envía a los ejecutivos objetivos,
            distribución del presupuesto y estrategias de ventas
            y mercadotecnia (plan anual Asokam)"]
        P2["EV-IMSS: Elabora y entrega plan de trabajo y solicitud
            de viáticos el día 15 de cada mes"]
        P3["GV-IMSS: Recibe plan y solicitud para revisión,
            autorización y envío al Coordinador Administrativo"]
        P4["CA: Inicia el proceso de viáticos según política vigente"]
    end

    subgraph E2 [Etapa 2 · Ejecuta visita por unidad médica]
        V1["EV-IMSS: Registra la visita vía App Control AT&T v1.35"]

        VMED["EV-IMSS: Visita área médica
              (Jefe anestesiología, Médico adscrito, Jefe Ceye/quirófano)"]
        VMED2["EV-IMSS: Da información/promoción de productos, entrega material
               y muestras, ejecuta estrategia, atiende quejas, gestiona CPM"]
        EPQ{¿Se requiere EP?}
        EP["EP: Asesoramiento, formación y apoyo técnico
            (soporte a quejas, sesiones médicas, dudas)"]
        VMED3["EV-IMSS: Recaba productividad en quirófano
               y actualiza fichero médico"]
        QJ{¿Se reportó una queja?}
        QJ1["EV-IMSS: Llena y envía Reporte de Incidente a
             Tecnovigilancia, GV-IMSS y Control de quejas; da seguimiento"]
        PQ[/PROCESO DE QUEJAS/]

        VADM["EV-IMSS: Visita área administrativa
              (Jefe de almacén, Jefe de abasto)"]
        VADM2["EV-IMSS: Atiende temas administrativos, da seguimiento a
               quejas, monitorea inventarios y gestiona traspasos"]
        VADM3["EV-IMSS: Recaba desplazamientos, existencias
               y monitorea CPM propios y de competencia"]

        VFIN["EV-IMSS: Registra conclusión de la visita vía App Control AT&T v1.35"]
    end

    subgraph E3 [Etapa 3 · Verifica reporte semanal]
        R1["GRI: Envía los lunes reporte de desplazamiento e inventarios
            de Delegaciones y UMAE IMSS al CA"]
        R2["MGPS: Descarga y envía los lunes el reporte de App Control AT&T
            al GV y al EE"]
        R3["CA: Recibe y procesa información para enviarla al EV"]
        R4["EE: Recibe y actualiza los indicadores de ventas cada semana"]
        R5["GV-IMSS: Supervisa cumplimiento del plan, actividades
            y estrategias (campo, AT&T, llamada/Zoom)"]
    end

    subgraph E4 [Etapa 4 · Mejora semanal y mensual]
        M1["GG, GV, DC, EE, GRI: Presentan al Director corporativo
            los indicadores de ventas los martes de cada semana"]
        OBJ{¿Se llegó al objetivo mensual?}
        M2["CA: Solicita comisiones al final del mes según política vigente"]
        M3["GV: Replantea estrategias de ventas en el plan de trabajo"]
    end

    FIN([FIN])

    INICIO --> P1 --> P2 --> P3 --> P4 --> V1
    V1 --> VMED --> VMED2 --> EPQ
    EPQ -- SI --> EP --> VMED3
    EPQ -- NO --> VMED3
    VMED3 --> QJ
    QJ -- SI --> QJ1 --> PQ
    QJ -- NO --> VADM
    PQ --> VADM
    V1 --> VADM
    VADM --> VADM2 --> VADM3 --> VFIN
    VFIN --> R1 & R2
    R1 --> R3 --> R4
    R2 --> R4
    R4 --> R5 --> M1 --> OBJ
    OBJ -- SI --> M2 --> FIN
    OBJ -- NO --> M3 --> FIN
```

## Véase también

- [[Proceso de Ventas IMSS]]
- [[Procedimiento Normalizado de Operación del Proceso de Ventas]]
- [[Ventas IMSS]]
- [[Diagrama del Proceso de Talleres Médicos]]
- [[Roles y Abreviaturas]]
