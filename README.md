# smartsearch

Herramienta local de búsqueda de archivos para **macOS y Linux**. Disponible en dos modos: CLI interactivo y UI web en el browser.

---

## Instalación

```bash
bash install.sh
```

El script detecta el sistema operativo y configura todo automáticamente:

| Paso | macOS | Linux |
|---|---|---|
| CLI en `~/bin` | symlink | symlink |
| PATH | `~/.zshrc` | `~/.bashrc` |
| Auto-inicio servidor | LaunchAgent (launchd) | systemd user service |

**Requisito:** Node.js instalado (`https://nodejs.org`).

---

## Archivos

| Archivo | Descripción |
|---|---|
| `smartsearch` | CLI interactivo (bash) |
| `smartsearch-ui.js` | Servidor web local (Node.js) |
| `install.sh` | Instalador para macOS y Linux |

---

## UI Web (recomendada)

El servidor corre en background desde el login. Abre en el browser:

```
http://localhost:7823
```

### Gestión del servidor

**macOS:**
```bash
# reiniciar
launchctl unload ~/Library/LaunchAgents/com.smartsearch.plist
launchctl load   ~/Library/LaunchAgents/com.smartsearch.plist

# detener
launchctl unload ~/Library/LaunchAgents/com.smartsearch.plist

# ver log
tail -f /tmp/smartsearch.log
```

**Linux:**
```bash
# reiniciar
systemctl --user restart smartsearch

# detener
systemctl --user stop smartsearch

# habilitar/deshabilitar auto-inicio
systemctl --user enable smartsearch
systemctl --user disable smartsearch

# ver log
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
- `iCloud Drive` — solo macOS: `~/Library/Mobile Documents/com~apple~CloudDocs`
- Unidades externas detectadas automáticamente:
  - macOS: `/Volumes/*`
  - Linux: `/media/$USER/*`, `/mnt/*`, `/run/media/$USER/*`

Cada volumen muestra su estado:
- 🟢 `Spotlight` — usa `mdfind` (rápido, solo macOS)
- 🟠 `sin índice` — escaneo directo con `find`

### Resultados

Ordenados alfabéticamente por nombre. Por cada archivo:
- **Abrir** — abre con la app por defecto del sistema
- **Mostrar** — revela el archivo en el explorador de archivos (Finder en macOS, Nautilus u otro en Linux)

---

## CLI (terminal)

```bash
smartsearch
```

Mismos parámetros que la UI pero en modo interactivo guiado.

### Acciones en resultados

```
1 / a1   → abrir archivo [1]
r1       → revelar archivo [1] en el explorador
m        → modificar un parámetro sin reiniciar búsqueda
n        → nueva búsqueda
q        → salir
```

---

## Dónde busca (y qué excluye)

### Perfil interno (`~`)
Busca en todos los directorios **visibles** de primer nivel en el home:
`~/Desktop`, `~/Documents`, `~/Downloads`, `~/Movies`, `~/Music`, `~/Pictures`, etc.

Excluye explícitamente:
- `~/Library` — datos de apps, navegadores, cachés (macOS)
- `~/Applications` — apps instaladas (macOS)
- Directorios ocultos (`~/.vscode`, `~/.npm`, `~/.git`, etc.)

### iCloud Drive (solo macOS)
Búsqueda completa dentro de `com~apple~CloudDocs`. Usa Spotlight si está indexado.

### Unidades externas
Sin exclusiones — busca el volumen completo.

---

## Motor de búsqueda

| Condición | Motor |
|---|---|
| Volumen con Spotlight activo (macOS) | `mdfind` |
| Volumen sin índice / Linux | `find` |
| Perfil interno (`~`) | `find` (whitelist de dirs visibles) |

**Nota técnica:** los queries de `mdfind` con `$time` se escapan antes de pasarlos al shell para evitar expansión de variables.

---

## Agregar más extensiones de documento

Editar la sección `doc-exts` en `smartsearch-ui.js`:

```html
<div class="chip" data-val="csv">CSV</div>
```

La función `search()` toma automáticamente los chips seleccionados.

---

## Actualizar y reiniciar

```bash
# editar el servidor
nano ~/bin/smartsearch-ui.js

# aplicar cambios — macOS
launchctl unload ~/Library/LaunchAgents/com.smartsearch.plist
launchctl load   ~/Library/LaunchAgents/com.smartsearch.plist

# aplicar cambios — Linux
systemctl --user restart smartsearch
```

---

## Distribuir a otro usuario

```bash
# clonar desde GitHub
git clone https://github.com/Xago/smartsearch-app
cd smartsearch-app
bash install.sh
```

O comprimir la carpeta y enviarla. El instalador funciona igual en macOS y Linux.
