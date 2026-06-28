# smartsearch

Herramienta local de búsqueda de archivos para macOS. Disponible en dos modos: CLI interactivo y UI web en el browser.

---

## Archivos

| Archivo | Descripción |
|---|---|
| `~/bin/smartsearch` | CLI interactivo (bash) |
| `~/bin/smartsearch-ui.js` | Servidor web local (Node.js) |
| `~/Library/LaunchAgents/com.santiago.smartsearch.plist` | Auto-inicio en login (launchd) |

---

## UI Web (recomendada)

El servidor corre en background desde el login. Abre directo en el browser:

```
http://localhost:7823
```

### Gestión del servidor

```bash
# reiniciar (obligatorio después de editar smartsearch-ui.js)
launchctl unload ~/Library/LaunchAgents/com.santiago.smartsearch.plist
launchctl load   ~/Library/LaunchAgents/com.santiago.smartsearch.plist

# detener
launchctl unload ~/Library/LaunchAgents/com.santiago.smartsearch.plist

# ver log de errores
tail -f /tmp/smartsearch.log
```

### Parámetros de búsqueda

**Tipo** — selección exclusiva:
- `Imágenes` — png, jpg, jpeg, webp, svg, heic
- `Documentos` — elegir extensiones: pdf, docx, xlsx, pptx, txt
- `Otro` — ingresar extensión libre (ej: `mp4`)

**Nombre parcial** — filtra por texto en el nombre del archivo. Vacío = sin filtro.

**Período**:
- `Última semana` / `Último mes` — relativo a hoy
- `Rango` — selección de fecha inicio y fin con picker nativo
- `Sin límite` — sin filtro de fecha

**Dónde buscar** — selección múltiple, todas apagadas por defecto:
- `Perfil de usuario (~)` — busca solo en directorios visibles del home, excluyendo `~/Library`, `~/Applications` y carpetas ocultas
- `iCloud Drive` — `~/Library/Mobile Documents/com~apple~CloudDocs`
- Unidades externas detectadas automáticamente (ej: MicroSD)

Cada volumen muestra su estado:
- 🟢 `Spotlight` — usa `mdfind` (rápido)
- 🟠 `find` — escaneo directo (más lento)

### Resultados

Ordenados alfabéticamente por nombre. Por cada archivo:
- **Abrir** — abre con la app por defecto
- **Finder** — revela el archivo en Finder seleccionado

---

## CLI (terminal)

```bash
smartsearch
```

Mismos parámetros que la UI pero en modo interactivo guiado. Útil para uso rápido desde terminal.

### Acciones en resultados

```
a1       → abrir archivo [1]
r1       → revelar archivo [1] en Finder
m        → modificar un parámetro sin reiniciar búsqueda
n        → nueva búsqueda
q        → salir
```

---

## Dónde busca (y qué excluye)

### Perfil interno (`~`)
Busca en todos los directorios **visibles** de primer nivel en el home:
`~/Desktop`, `~/Documents`, `~/Downloads`, `~/Movies`, `~/Music`, `~/Pictures`, `~/smarteck`, etc.

Excluye explícitamente:
- `~/Library` — datos de apps, navegadores, cachés
- `~/Applications` — apps instaladas
- Directorios ocultos (`~/.vscode`, `~/.npm`, `~/.git`, etc.)

### iCloud Drive
Búsqueda completa dentro de `com~apple~CloudDocs`. Usa Spotlight si está indexado.

### Unidades externas
Sin exclusiones — busca el volumen completo.

---

## Motor de búsqueda

| Condición | Motor |
|---|---|
| Volumen con Spotlight activo | `mdfind` |
| Volumen sin índice Spotlight | `find` |
| Perfil interno (`~`) | `find` (whitelist de dirs visibles) |

**Nota técnica:** los queries de `mdfind` con `$time` se escapan antes de pasarlos al shell para evitar expansión de variables (`$time` → vacío → query inválido).

---

## Agregar más extensiones de documento

Editar la sección `doc-exts` en `smartsearch-ui.js`:

```html
<div class="chip" data-val="csv">CSV</div>
```

Y en la función `search()` del mismo archivo, la lógica de tipo `docs` las tomará automáticamente desde los chips seleccionados.

---

## Actualizar y reiniciar

```bash
# editar el servidor
nano ~/bin/smartsearch-ui.js

# aplicar cambios
launchctl unload ~/Library/LaunchAgents/com.santiago.smartsearch.plist
launchctl load   ~/Library/LaunchAgents/com.santiago.smartsearch.plist
```
