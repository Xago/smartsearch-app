#!/usr/bin/env node
// smartsearch-ui — interfaz web local para búsqueda de archivos en macOS y Linux
// ponytail: http nativo, HTML inline, sin dependencias extra

const http = require('http')
const { exec } = require('child_process')
const path  = require('path')
const { promisify } = require('util')
const run  = promisify(exec)
const HOME = process.env.HOME
const PORT = 7823
const OS   = require('os').platform()   // 'darwin' | 'linux'

const sh = async cmd => { try { return (await run(cmd)).stdout.trim() } catch { return '' } }
const safe  = p => p.replace(/"/g, '\\"')          // escapar rutas con comillas
const safeQ = q => q.replace(/\$/g, '\\$')        // escapar $ para que shell no expanda $time

// ── volúmenes ─────────────────────────────────────────────────────────────────

async function getVolumes () {
  const vols = [{ path: HOME, label: 'Perfil de usuario (~)' }]

  if (OS === 'darwin') {
    // iCloud Drive — dentro de Library pero es contenido del usuario
    const icloud = `${HOME}/Library/Mobile Documents/com~apple~CloudDocs`
    if ((await sh(`test -d "${icloud}" && echo yes`)) === 'yes')
      vols.push({ path: icloud, label: 'iCloud Drive' })

    const ext = await sh('find /Volumes -maxdepth 1 -mindepth 1 -type d 2>/dev/null | grep -v TimeMachine | sort')
    for (const v of ext.split('\n').filter(Boolean))
      vols.push({ path: v, label: path.basename(v) + ' (externa)' })
  } else {
    // ponytail: cubre udisks2 (Ubuntu), /mnt manual y Fedora/run/media
    for (const base of [`/media/${process.env.USER}`, '/media', '/mnt', `/run/media/${process.env.USER}`]) {
      const dirs = await sh(`test -d "${base}" && find "${base}" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort`)
      for (const v of dirs.split('\n').filter(Boolean))
        vols.push({ path: v, label: path.basename(v) + ' (externa)' })
    }
  }

  for (const v of vols) {
    if (OS !== 'darwin') { v.indexed = false; continue }
    const mp = await sh(`df -P "${safe(v.path)}" 2>/dev/null | awk 'NR==2{print $6}'`)
    v.indexed = (await sh(`mdutil -s "${safe(mp)}" 2>/dev/null`)).includes('Indexing enabled')
  }
  return vols
}

// ── búsqueda ──────────────────────────────────────────────────────────────────

async function search ({ type, extensions, nameFilter, period, dateFrom, dateTo, volumes }) {
  // tipo → mdfind query + patrones find
  let mdType, exts
  if (type === 'images') {
    mdType = "kMDItemContentTypeTree == 'public.image'"
    exts   = ['png','jpg','jpeg','webp','svg','heic']
  } else {
    exts   = extensions?.length ? extensions : ['pdf','docx','xlsx','pptx','txt']
    mdType = `(${exts.map(e => `kMDItemFSName == '*.${e}'cd`).join(' || ')})`
  }
  const findTypePat = `\\( ${exts.map(e => `-iname "*.${e}"`).join(' -o ')} \\)`

  // fecha
  let mdDate = '', findDate = ''
  if (period === 'week')  { mdDate = 'kMDItemFSContentChangeDate >= $time.today(-7)';  findDate = '-mtime -7' }
  if (period === 'month') { mdDate = 'kMDItemFSContentChangeDate >= $time.today(-30)'; findDate = '-mtime -30' }
  if (period === 'range' && dateFrom && dateTo) {
    mdDate = `kMDItemFSContentChangeDate >= $time.iso(${dateFrom}) && kMDItemFSContentChangeDate <= $time.iso(${dateTo})`
    const now = Date.now()
    const dFrom = Math.ceil((now - new Date(dateFrom)) / 86400000) + 1
    const dTo   = Math.floor((now - new Date(dateTo))  / 86400000)
    findDate = `-mtime -${dFrom}${dTo > 0 ? ` -mtime +${dTo}` : ''}`
  }

  // nombre
  const mdName  = nameFilter ? ` && kMDItemDisplayName == '*${nameFilter}*'cd` : ''
  const findName = nameFilter ? `-iname "*${nameFilter}*"` : ''

  let mdQuery = `(${mdType})`
  if (mdDate) mdQuery += ` && ${mdDate}`
  mdQuery += mdName

  const findArgs = [findTypePat, findDate, findName].filter(Boolean).join(' ')

  const found = new Set()

  for (const vol of volumes) {
    if (vol === HOME) {
      // solo dirs visibles del perfil (excluye Library, Applications, ocultos)
      const dirs = (await sh(
        `find "${HOME}" -maxdepth 1 -mindepth 1 -type d ! -name ".*" ! -name "Library" ! -name "Applications" 2>/dev/null | sort`
      )).split('\n').filter(Boolean)

      ;(await sh(`find "${HOME}" -maxdepth 1 -type f ${findArgs} 2>/dev/null`))
        .split('\n').filter(Boolean).forEach(f => found.add(f))

      for (const d of dirs)
        (await sh(`find "${safe(d)}" -type f ${findArgs} 2>/dev/null`))
          .split('\n').filter(Boolean).forEach(f => found.add(f))
    } else {
      const mp      = await sh(`df -P "${safe(vol)}" 2>/dev/null | awk 'NR==2{print $6}'`)
      const indexed = OS === 'darwin'
        ? (await sh(`mdutil -s "${safe(mp)}" 2>/dev/null`)).includes('Indexing enabled')
        : false
      const out     = indexed
        ? await sh(`mdfind "${safeQ(mdQuery)}" -onlyin "${safe(vol)}" 2>/dev/null`)
        : await sh(`find "${safe(vol)}" -type f ${findArgs} 2>/dev/null`)
      out.split('\n').filter(Boolean).forEach(f => found.add(f))
    }
  }

  // stats + ordenar por fecha desc
  const results = await Promise.all([...found].map(async f => {
    const statCmd = OS === 'darwin' ? `stat -f "%m|%z" "${safe(f)}"` : `stat -c "%Y|%s" "${safe(f)}"`
    const stat = await sh(`${statCmd} 2>/dev/null`)
    const [mtime, size] = stat.split('|').map(Number)
    return { path: f, name: path.basename(f), mtime: mtime || 0, size: size || 0 }
  }))
  return results.filter(r => r.mtime > 0).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`)
  const json = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const body = () => new Promise(resolve => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(JSON.parse(d || '{}')))
  })

  try {
    if (req.method === 'GET'  && url.pathname === '/')             { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(HTML) }
    if (req.method === 'GET'  && url.pathname === '/api/volumes')  return json(await getVolumes())
    if (req.method === 'POST' && url.pathname === '/api/search')   return json(await search(await body()))
    if (req.method === 'POST' && url.pathname === '/api/open') {
      const { path: p } = await body()
      await sh(OS === 'darwin' ? `open "${safe(p)}"` : `xdg-open "${safe(p)}"`)
      return json({ ok: true })
    }
    if (req.method === 'POST' && url.pathname === '/api/reveal') {
      const { path: p } = await body()
      if (OS === 'darwin') {
        await sh(`open -R "${safe(p)}"`)
      } else {
        const hasNautilus = await sh('command -v nautilus')
        await sh(hasNautilus ? `nautilus --select "${safe(p)}"` : `xdg-open "${safe(path.dirname(p))}"`)
      }
      return json({ ok: true })
    }
  } catch (e) { return json({ error: e.message }, 500) }

  res.writeHead(404); res.end()
})

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`
  console.log(`\nsmарtsearch UI → ${url}\n`)
  exec(OS === 'darwin' ? `open ${url}` : `xdg-open ${url}`)
})

// ── HTML ──────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>smartsearch</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f7;color:#1d1d1f;padding:28px;max-width:820px;margin:0 auto}
h1{font-size:1.45rem;font-weight:700;margin-bottom:22px;letter-spacing:-.02em}
.card{background:#fff;border-radius:14px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.07)}
.label{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#999;margin-bottom:11px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;background:#f2f2f2;cursor:pointer;font-size:.87rem;border:1.5px solid transparent;transition:all .12s;user-select:none}
.chip.on{background:#e8f0fe;border-color:#007aff;color:#007aff;font-weight:500}
.chip input{position:absolute;opacity:0;pointer-events:none}
input[type=text],input[type=date]{border:1.5px solid #e0e0e0;border-radius:10px;padding:8px 12px;font-size:.9rem;outline:none;background:#fafafa;font-family:inherit;transition:border-color .15s}
input[type=text]:focus,input[type=date]:focus{border-color:#007aff;background:#fff}
.date-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
.date-row small{font-size:.83rem;color:#888}
.btn{background:#007aff;color:#fff;border:none;border-radius:10px;padding:10px 28px;font-size:.95rem;font-weight:600;cursor:pointer;transition:background .15s}
.btn:hover{background:#0066d6}
.btn:disabled{background:#aaa;cursor:default}
.btn-sm{background:#f2f2f2;border:1px solid #e0e0e0;border-radius:8px;padding:5px 12px;font-size:.78rem;cursor:pointer;transition:background .15s;white-space:nowrap}
.btn-sm:hover{background:#e5e5e5}
.result{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f3f3f3}
.result:last-child{border-bottom:none}
.rinfo{flex:1;min-width:0;padding-right:12px}
.rname{font-weight:500;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rpath{font-size:.74rem;color:#aaa;word-break:break-all;margin-top:2px}
.rage{font-size:.73rem;color:#ccc;margin-top:2px}
.rbtns{display:flex;gap:6px;flex-shrink:0;padding-top:2px}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.g{background:#34c759}.o{background:#ff9500}
#status{font-size:.85rem;color:#888;margin-left:14px}
#count{font-size:.83rem;color:#777;margin-bottom:10px}
</style>
</head>
<body>
<h1>&#x1F50D; smartsearch</h1>

<div class="card">
  <div class="label">Tipo</div>
  <div class="chips" id="type-grp">
    <div class="chip on" data-val="images">Imágenes</div>
    <div class="chip"    data-val="docs">Documentos</div>
    <div class="chip"    data-val="other">Otro</div>
  </div>
  <div id="doc-exts" style="display:none;margin-top:12px">
    <div class="chips" id="ext-grp">
      <div class="chip" data-val="pdf">PDF</div>
      <div class="chip" data-val="docx">DOCX</div>
      <div class="chip" data-val="xlsx">XLSX</div>
      <div class="chip" data-val="pptx">PPTX</div>
      <div class="chip" data-val="txt">TXT</div>
    </div>
  </div>
  <div id="other-ext" style="display:none;margin-top:12px">
    <input type="text" id="custom-ext" placeholder="extensión sin punto  (ej: mp4)" style="width:260px">
  </div>
</div>

<div class="card">
  <div class="label">Nombre parcial</div>
  <input type="text" id="name-filter" placeholder="Vacío = buscar todo" style="width:100%;max-width:380px">
</div>

<div class="card">
  <div class="label">Período</div>
  <div class="chips" id="period-grp">
    <div class="chip"    data-val="week">Última semana</div>
    <div class="chip"    data-val="month">Último mes</div>
    <div class="chip"    data-val="range">Rango</div>
    <div class="chip on" data-val="all">Sin límite</div>
  </div>
  <div id="date-range" style="display:none">
    <div class="date-row">
      <small>Desde</small><input type="date" id="date-from">
      <small>Hasta</small><input type="date" id="date-to">
    </div>
  </div>
</div>

<div class="card">
  <div class="label">Dónde buscar</div>
  <div class="chips" id="vol-grp"><span style="color:#ccc;font-size:.85rem">Detectando…</span></div>
</div>

<div style="display:flex;align-items:center;margin-bottom:20px">
  <button class="btn" id="btn-search">Buscar</button>
  <span id="status"></span>
</div>

<div class="card" id="result-card" style="display:none">
  <div class="label">Resultados</div>
  <div id="count"></div>
  <div id="result-list"></div>
</div>

<script>
let _results = []

// ── chips (radio y multi) ─────────────────────────────────────────────────────
function radioChips (groupId, onChange) {
  const grp = document.getElementById(groupId)
  grp.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    grp.querySelectorAll('.chip').forEach(x => x.classList.remove('on'))
    c.classList.add('on')
    onChange && onChange(c.dataset.val)
  }))
}
function multiChips (groupId) {
  document.getElementById(groupId).querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => c.classList.toggle('on')))
}
function chipVal  (groupId) { return document.querySelector('#' + groupId + ' .chip.on')?.dataset.val }
function chipVals (groupId) { return [...document.querySelectorAll('#' + groupId + ' .chip.on')].map(c => c.dataset.val) }

radioChips('type-grp', v => {
  document.getElementById('doc-exts').style.display  = v === 'docs'  ? 'block' : 'none'
  document.getElementById('other-ext').style.display = v === 'other' ? 'block' : 'none'
})
radioChips('period-grp', v => {
  document.getElementById('date-range').style.display = v === 'range' ? 'block' : 'none'
})
multiChips('ext-grp')

// fechas por defecto
const pad = n => String(n).padStart(2,'0')
const fmtDate = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
document.getElementById('date-to').value   = fmtDate(new Date())
document.getElementById('date-from').value = fmtDate(new Date(Date.now() - 30*86400000))

// ── volúmenes ─────────────────────────────────────────────────────────────────
fetch('/api/volumes').then(r => r.json()).then(vols => {
  document.getElementById('vol-grp').innerHTML = vols.map(v =>
    \`<div class="chip" data-path="\${v.path}">
      <span class="dot \${v.indexed ? 'g' : 'o'}"></span> \${v.label}
    </div>\`
  ).join('')
  document.querySelectorAll('#vol-grp .chip').forEach(c =>
    c.addEventListener('click', () => c.classList.toggle('on')))
})

// ── búsqueda ──────────────────────────────────────────────────────────────────
document.getElementById('btn-search').addEventListener('click', doSearch)
document.addEventListener('keydown', e => { if (e.metaKey && e.key === 'Enter') doSearch() })

async function doSearch () {
  const type      = chipVal('type-grp')
  const period    = chipVal('period-grp')
  const volumes   = [...document.querySelectorAll('#vol-grp .chip.on')].map(c => c.dataset.path)
  const nameFilter = document.getElementById('name-filter').value.trim()

  let extensions = []
  if (type === 'docs')  extensions = chipVals('ext-grp')
  if (type === 'other') extensions = [document.getElementById('custom-ext').value.trim()].filter(Boolean)

  if (!volumes.length) { alert('Selecciona al menos un volumen'); return }

  const btn = document.getElementById('btn-search')
  btn.disabled = true
  document.getElementById('status').textContent = 'Buscando…'
  document.getElementById('result-card').style.display = 'none'

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, extensions, nameFilter, period, volumes,
        dateFrom: document.getElementById('date-from').value,
        dateTo:   document.getElementById('date-to').value
      })
    })
    _results = await res.json()
    render()
  } catch (e) {
    alert('Error: ' + e.message)
  } finally {
    btn.disabled = false
    document.getElementById('status').textContent = ''
  }
}

function age (mtime) {
  const d = Math.floor((Date.now()/1000 - mtime) / 86400)
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : \`hace \${d}d\`
}

function render () {
  document.getElementById('result-card').style.display = 'block'
  document.getElementById('count').textContent = \`\${_results.length} archivo(s) encontrado(s)\`
  document.getElementById('result-list').innerHTML = _results.length
    ? _results.map((f, i) => \`
        <div class="result">
          <div class="rinfo">
            <div class="rname" title="\${f.name}">\${f.name}</div>
            <div class="rpath">\${f.path}</div>
            <div class="rage">\${age(f.mtime)}</div>
          </div>
          <div class="rbtns">
            <button class="btn-sm" onclick="act('open',\${i})">Abrir</button>
            <button class="btn-sm" onclick="act('reveal',\${i})">Mostrar</button>
          </div>
        </div>\`
    ).join('')
    : '<p style="color:#ccc;padding:20px 0;text-align:center">Sin resultados</p>'
}

async function act (type, idx) {
  await fetch(\`/api/\${type}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: _results[idx].path })
  })
}
</script>
</body>
</html>`
