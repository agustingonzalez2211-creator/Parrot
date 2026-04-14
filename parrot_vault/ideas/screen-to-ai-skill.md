# Screen-to-AI-Skill Generator

> De grabaciones de pantalla a skills de IA empaquetables y reutilizables.

**Estado:** Analisis y Diseno
**Fecha:** 2026-04-14
**Tipo:** Hackathon / Proyecto

---

## Vision

Cualquier persona puede grabar su pantalla mientras realiza una tarea. Esa grabacion se transforma automaticamente en un **AI Skill**: una unidad de conocimiento empaquetada que cualquier agente de IA puede cargar, entender y ejecutar en el contexto que necesite.

No se trata de automatizar clicks. Se trata de **capturar conocimiento humano y hacerlo portable para IAs**.

---

## Problema

- El conocimiento de "como hacer X" vive en la cabeza de las personas
- Documentar procesos manualmente es tedioso y nadie lo mantiene actualizado
- Los agentes de IA no pueden aprender tareas nuevas sin que alguien las codifique explicitamente
- No existe un formato estandar para transferir conocimiento de workflows humanos a IAs

---

## Solucion

Un pipeline de tres etapas:

```
[Grabacion de pantalla] → [Analisis con AI] → [AI Skill empaquetado]
```

El usuario graba, la IA analiza, y el resultado es un skill portable que cualquier agente puede usar.

---

## Arquitectura Conceptual

### 1. Captura
- Grabacion de pantalla (video)
- Captura de eventos del sistema (clicks, teclas, navegacion, cambios de ventana)
- Metadata contextual (app activa, URLs, timestamps)

### 2. Analisis
- Motor de vision/AI que interpreta los frames del video
- Deteccion de acciones semanticas (no solo "click en pixel X,Y" sino "abrir menu de configuracion")
- Extraccion de precondiciones y decisiones ("si aparece este modal, hacer X")
- Identificacion de datos variables vs. constantes en el flujo

### 3. Modelo de Datos del Workflow

```yaml
skill:
  name: "crear-reporte-mensual"
  version: 1
  description: "Genera el reporte mensual de ventas desde el dashboard"
  
  context:
    apps: ["Chrome", "Google Sheets"]
    preconditions:
      - "Estar logueado en el dashboard de ventas"
  
  steps:
    - id: 1
      action: "navegar"
      target: "dashboard > reportes > mensual"
      description: "Ir a la seccion de reportes mensuales"
    
    - id: 2
      action: "seleccionar"
      target: "selector de periodo"
      value: "{{mes_actual}}"
      description: "Elegir el mes actual en el filtro"
    
    - id: 3
      action: "click"
      target: "boton exportar CSV"
      wait_for: "descarga completa"
    
    - id: 4
      action: "abrir"
      target: "Google Sheets > template reporte"
      description: "Abrir el template del reporte"
    
    - id: 5
      action: "importar"
      target: "datos del CSV descargado"
      decision:
        if: "columnas no coinciden"
        then: "mapear columnas manualmente"

  inputs:
    - name: "mes_actual"
      type: "date_month"
      required: true

  outputs:
    - name: "reporte_generado"
      type: "spreadsheet"
```

### 4. Generador de Skills
- Toma el workflow analizado y lo empaqueta en un formato estandar
- Genera un archivo `.skill` (YAML/JSON) portable
- Incluye metadata, pasos, decisiones, inputs/outputs
- Versionable y distribuible

### 5. Runtime
- Cualquier agente de IA carga el `.skill`
- Lo interpreta en su contexto (puede ser otro SO, otra app, otra IA)
- Adapta las acciones al entorno disponible
- Pide inputs al usuario cuando es necesario

---

## Flujo del Usuario

```
1. Usuario abre la app y presiona "Grabar"
2. Realiza el flujo de trabajo como siempre lo hace
3. Presiona "Detener"
4. La app analiza la grabacion (puede tardar unos segundos)
5. Muestra un preview del skill generado:
   - Lista de pasos detectados
   - Variables identificadas
   - Decisiones/branches encontrados
6. Usuario puede editar/refinar los pasos
7. Presiona "Empaquetar Skill"
8. Resultado: archivo .skill listo para distribuir
```

---

## Formato del Skill

### Estructura del paquete

```
mi-skill/
  skill.yaml          # Definicion principal
  metadata.json       # Autor, version, tags, compatibilidad
  screenshots/        # Frames de referencia para cada paso
  README.md           # Descripcion legible por humanos
```

### Distribucion
- Repositorio central de skills (tipo npm/marketplace)
- Compartir por archivo directo
- Embeber en prompts de agentes de IA
- Integrar via API

---

## Preguntas Abiertas

- **Granularidad:** Hasta que nivel de detalle debe llegar el analisis? (click-level vs semantic-level)
- **Portabilidad:** Como hacer que un skill grabado en Mac funcione en Windows? Abstraer las acciones del OS?
- **Decisiones complejas:** Como capturar logica condicional compleja que el usuario hace mentalmente?
- **Datos sensibles:** Como manejar grabaciones que contienen passwords, datos personales, etc.?
- **Formato estandar:** Definir un spec abierto para `.skill` que otros puedan adoptar?
- **Ejecucion:** El runtime ejecuta directamente o solo guia al agente? (autonomo vs asistido)
- **Feedback loop:** Como mejorar el skill con cada ejecucion? (el agente reporta errores y el skill se refina)

---

## Ideas Adicionales

- **Skill chaining:** Componer skills complejos a partir de skills simples
- **Skill marketplace:** Comunidad donde la gente comparte skills
- **Version control:** Git-like para skills, con diffs entre versiones
- **Testing:** Ejecutar el skill en un sandbox para validar antes de distribuir
- **Multi-modal:** No solo pantalla, tambien voz del usuario explicando lo que hace

---

## Proximos Pasos

- [ ] Validar el concepto con un prototipo minimo (grabar + analizar un flujo simple)
- [ ] Definir el spec del formato `.skill`
- [ ] Investigar APIs de grabacion de pantalla y captura de eventos
- [ ] Evaluar modelos de vision para el analisis (GPT-4V, Claude Vision, etc.)
- [ ] Disenar la UI del editor de skills
