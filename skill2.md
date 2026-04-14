---
name: parrot-buscar-play5
description: Skill de prueba generada por Parrot. Abre Mercado Libre y busca una PlayStation 5, muestra los primeros resultados. Requiere Windows-MCP para control de escritorio en Windows.
disable-model-invocation: true
allowed-tools: Bash(start *) Bash(open *) Bash(xdg-open *) mcp__windows-mcp__screenshot mcp__windows-mcp__snapshot mcp__windows-mcp__scrape mcp__windows-mcp__app mcp__windows-mcp__type mcp__windows-mcp__click mcp__windows-mcp__scroll
---

## Setup automatico

Sistema operativo: !`uname -s`
uv disponible: !`uv --version 2>/dev/null || echo "no instalado"`
Windows-MCP disponible: !`uvx windows-mcp --version 2>/dev/null || echo "no instalado"`

Si Windows-MCP no esta instalado, seguir estos pasos antes de continuar:

1. Instalar uv (gestor de paquetes Python):
```bash
pip install uv
```

2. Agregar Windows-MCP a Claude Code:
```bash
claude mcp add --transport stdio windows-mcp -- uvx windows-mcp
```

3. Reiniciar Claude Code para que cargue el MCP.
4. Verificar con `/mcp` que `windows-mcp` aparece como conectado.

Una vez instalado, continuar con los pasos.

## Objetivo

Abrir Mercado Libre Argentina, buscar "PlayStation 5", extraer los primeros 3 resultados con nombre y precio, y reportarlos al usuario.

## Pasos

### 1. Abrir Mercado Libre con la busqueda
Ejecutar el comando segun el sistema operativo detectado:
```bash
start "https://listado.mercadolibre.com.ar/playstation-5" || open "https://listado.mercadolibre.com.ar/playstation-5" || xdg-open "https://listado.mercadolibre.com.ar/playstation-5"
```
Esperar 4 segundos a que cargue la pagina.

### 2. Verificar que la pagina cargo
Usar `mcp__windows-mcp__snapshot` para tomar una captura del estado actual del escritorio.
Verificar que Mercado Libre se abrio con los resultados de busqueda de PlayStation 5.

Si aparece algun popup o banner de cookies, cerrarlo haciendo click en el boton de cerrar o aceptar.

### 3. Leer los resultados
Usar `mcp__windows-mcp__snapshot` con `use_dom=True` para inspeccionar los elementos de la pagina directamente desde el navegador abierto.
Identificar los primeros 3 resultados de busqueda, extrayendo:
- **Nombre** del producto
- **Precio** (en pesos argentinos)
- Si tiene **envio gratis** o no

Si los resultados no son visibles, usar `mcp__windows-mcp__scroll` para bajar un poco en la pagina y volver a tomar snapshot.

### 4. Reportar al usuario
Mostrar un resumen con los 3 primeros resultados en formato:

1. **Nombre del producto** - $Precio (Envio gratis / Envio con cargo)
2. **Nombre del producto** - $Precio (Envio gratis / Envio con cargo)
3. **Nombre del producto** - $Precio (Envio gratis / Envio con cargo)

Si no se encontraron resultados relevantes, usar `mcp__windows-mcp__screenshot` para tomar una captura e informar al usuario lo que se ve en pantalla.

## Parametros
Ninguno. Esta es una skill de prueba con busqueda fija de PlayStation 5.

## Resultado esperado
El usuario recibe un resumen de los primeros 3 resultados de Mercado Libre para "PlayStation 5" con nombre, precio e informacion de envio.

## Notas
Skill generada como prueba de concepto del proyecto Parrot.
Demuestra: busqueda en sitio de e-commerce, extraccion de datos estructurados (nombre + precio), y reporte al usuario.

Windows-MCP provee: screenshot, snapshot, click, type, scroll, drag, shortcut, shell, scrape, app, clipboard, process, registry, notification.
Repositorio: https://github.com/CursorTouch/Windows-MCP
