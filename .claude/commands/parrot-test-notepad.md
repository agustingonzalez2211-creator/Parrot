# Parrot Skill: Test Notepad Flow

> Skill de prueba para verificar que Parrot puede replicar un flujo en Windows.
> Abre Notepad, escribe un mensaje, y guarda el archivo en el escritorio.

## Requisitos

Este skill necesita **Windows-MCP** instalado como MCP server.
Verificalo con `/mcp` antes de ejecutar.

## Instrucciones de ejecucion

Ejecuta el siguiente flujo paso a paso. Despues de **cada accion**, toma un screenshot
y evalua si el resultado es el esperado antes de continuar.
Si un paso falla, intenta resolverlo usando el contexto visual del screenshot.

## Flow

```yaml
name: "test-notepad"
description: "Abre Notepad, escribe un mensaje y lo guarda en el escritorio"
execution: desktop
steps:
  - id: 1
    action: open_app
    target: "Notepad"
    description: "Abrir la aplicacion Notepad de Windows"
    verify: "Ventana de Notepad abierta con documento en blanco"

  - id: 2
    action: wait
    seconds: 2
    description: "Esperar que Notepad cargue completamente"

  - id: 3
    action: click
    target: "area de texto del Notepad"
    description: "Click en el area de edicion para asegurar foco"
    verify: "Cursor de texto visible en el area de edicion"

  - id: 4
    action: type
    text: "=== PARROT TEST ===\n\nEste archivo fue creado automaticamente por Parrot.\nFecha: {{fecha_actual}}\n\nSi podes leer esto, el skill funciono correctamente.\nEl flujo fue: abrir notepad -> escribir -> guardar.\n\n--- Parrot v0.1 - Hackathon Build ---"
    description: "Escribir el mensaje de prueba"
    verify: "Texto visible en el editor"

  - id: 5
    action: key
    value: "ctrl+shift+s"
    description: "Abrir dialogo Guardar Como"
    verify: "Dialogo de guardar archivo abierto"

  - id: 6
    action: wait
    seconds: 1
    description: "Esperar que abra el dialogo"

  - id: 7
    action: type
    text: "parrot-test.txt"
    description: "Escribir nombre del archivo"

  - id: 8
    action: key
    value: "Enter"
    description: "Confirmar guardado"
    verify: "Archivo guardado, titulo de ventana muestra parrot-test.txt"

  - id: 9
    action: wait
    seconds: 1
    description: "Esperar que se guarde"

  - id: 10
    action: verify
    expect: "El titulo de la ventana de Notepad muestra 'parrot-test' en el nombre"
    screenshot: true
    description: "Verificacion final - confirmar que el archivo se guardo correctamente"
```

## Comportamiento esperado

1. Se abre Notepad
2. Se escribe un mensaje de prueba con la fecha actual
3. Se guarda como `parrot-test.txt`
4. Se verifica que el guardado fue exitoso

## Troubleshooting

- Si `open_app` no funciona, intenta con `Shortcut: Win+R` -> escribir `notepad` -> Enter
- Si `ctrl+shift+s` no abre el dialogo, intenta con `ctrl+s` (si es archivo nuevo, abre Save As igual)
- Si el dialogo de guardar no acepta el nombre, hace click en el campo "File name" primero
- Reemplaza `{{fecha_actual}}` con la fecha y hora real al momento de ejecutar
