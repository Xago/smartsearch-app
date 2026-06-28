# smartsearch

> **Find files without the frustration.**
> **Encuentra archivos sin el sufrimiento.**

---

Searching for a file on Mac or Linux can feel like an exhausting task. Finder often returns a flood of unrelated results. On Linux, it's even worse for most users. Built-in search tools are complex, unfriendly, and get in your way.

**smartsearch** was built out of that frustration. It asks you simple questions — what type of file, part of the name, when, where — and returns exactly what you're looking for. Nothing more.

---

Buscar un archivo en Mac o Linux puede volverse agotador. El Finder muchas veces arroja resultados que no tienen nada que ver con lo que buscas. En Linux, para la mayoría de los usuarios, es aún peor. Las herramientas de búsqueda nativas son complejas, poco amigables y te hacen perder tiempo.

**smartsearch** nació de esa frustración. Te hace preguntas simples — qué tipo de archivo, parte del nombre, cuándo, dónde — y te devuelve exactamente lo que necesitas. Nada más.

---

## Features / Características

- 🔍 Search by file type, partial name, date range or location
- 🖥️ Works on **macOS and Linux**
- 🌐 Clean web UI in the browser — or use it from the terminal
- 📁 Searches your profile, iCloud Drive (macOS) and external drives
- ⚡ Uses Spotlight on macOS when available, `find` everywhere else
- 🔒 100% local — no cloud, no account, no tracking

---

- 🔍 Busca por tipo de archivo, nombre parcial, rango de fechas o ubicación
- 🖥️ Funciona en **macOS y Linux**
- 🌐 UI web limpia en el browser — o úsalo desde la terminal
- 📁 Busca en tu perfil, iCloud Drive (macOS) y unidades externas
- ⚡ Usa Spotlight en macOS cuando está disponible, `find` en todo lo demás
- 🔒 100% local — sin nube, sin cuenta, sin rastreo

---

## Installation / Instalación

```bash
git clone https://github.com/Xago/smartsearch-app
cd smartsearch-app
bash install.sh
```

**Requires / Requiere:** Node.js → https://nodejs.org

The installer detects your OS and configures everything automatically.
El instalador detecta tu sistema operativo y lo configura todo automáticamente.

Then open in your browser / Luego abre en el browser:
```
http://localhost:7823
```

---

## How it works / Cómo funciona

The installer sets up a background server that starts automatically on login — no need to run anything manually. Just open the browser and search.

El instalador configura un servidor en background que arranca automáticamente con el login — no necesitas correr nada manualmente. Solo abre el browser y busca.

| OS | Auto-start |
|---|---|
| macOS | LaunchAgent (launchd) |
| Linux | systemd user service |

---

## Server management / Gestión del servidor

**macOS:**
```bash
# restart / reiniciar
launchctl unload ~/Library/LaunchAgents/com.smartsearch.plist
launchctl load   ~/Library/LaunchAgents/com.smartsearch.plist

# logs
tail -f /tmp/smartsearch.log
```

**Linux:**
```bash
# restart / reiniciar
systemctl --user restart smartsearch

# logs
tail -f /tmp/smartsearch.log
```

---

## Search parameters / Parámetros de búsqueda

**Type / Tipo:**
- Images / Imágenes — select specific formats: PNG, JPG, JPEG, WEBP, SVG, HEIC (none selected = all / ninguna = todas)
- Documents / Documentos — select specific formats: PDF, DOCX, XLSX, PPTX, TXT (none selected = all / ninguna = todas)
- Other / Otro — any extension / cualquier extensión

**Name / Nombre:** partial match, case-insensitive / coincidencia parcial, sin distinción de mayúsculas

**Period / Período:** last week, last month, custom range, or no limit / última semana, último mes, rango personalizado o sin límite

**Where / Dónde:** user profile, iCloud Drive (macOS), external drives / perfil de usuario, iCloud Drive (macOS), unidades externas

**Results / Resultados:** sorted alphabetically. Each file has Open and Show (reveal in file manager) buttons. A **Modificar búsqueda** button at the top of the results scrolls back to the form to adjust any parameter and search again.

Los resultados están ordenados alfabéticamente. Cada archivo tiene botones Abrir y Mostrar. El botón **Modificar búsqueda** en el encabezado de resultados sube al formulario para ajustar cualquier parámetro y volver a buscar.

---

## Where it searches / Dónde busca

### User profile / Perfil de usuario (`~`)
Searches all **visible** top-level directories in your home folder. Automatically excludes:
Busca todos los directorios **visibles** de primer nivel en tu carpeta personal. Excluye automáticamente:

- `~/Library` — app data, caches / datos de apps, cachés (macOS)
- `~/Applications` (macOS)
- Hidden directories / Directorios ocultos (`~/.git`, `~/.npm`, etc.)

### External drives / Unidades externas
- macOS: `/Volumes/*`
- Linux: `/media/$USER/*`, `/mnt/*`, `/run/media/$USER/*`

---

## CLI (terminal)

```bash
smartsearch
```

Same parameters, guided interactive mode.
Mismos parámetros, modo interactivo guiado.

```
1 / a1   → open file / abrir archivo
r1       → reveal in file manager / mostrar en explorador
m        → modify one parameter / modificar un parámetro
n        → new search / nueva búsqueda
q        → quit / salir
```

---

## Add more document extensions / Agregar extensiones de documento

Add a chip in `smartsearch-ui.js`:
Agregar un chip en `smartsearch-ui.js`:

```html
<div class="chip" data-val="csv">CSV</div>
```

The search function picks it up automatically.
La función de búsqueda lo toma automáticamente.
