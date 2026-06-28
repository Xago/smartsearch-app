#!/usr/bin/env bash
# install.sh — instala smartsearch para el usuario actual en macOS
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
NODE=$(which node 2>/dev/null || echo "")
PLIST="$HOME/Library/LaunchAgents/com.smartsearch.plist"

echo ""
echo "── smartsearch install ──────────────────────────"
echo "  Directorio: $DIR"
echo "  Usuario:    $USER ($HOME)"

# ── node.js requerido ──────────────────────────────────────────────────────────
if [[ -z "$NODE" ]]; then
  echo ""
  echo "  ✗ Node.js no encontrado. Instálalo desde https://nodejs.org y vuelve a correr este script."
  exit 1
fi
echo "  Node.js:    $NODE ($(node --version))"

# ── permisos de ejecución ──────────────────────────────────────────────────────
chmod +x "$DIR/smartsearch"
chmod +x "$DIR/smartsearch-ui.js"

# ── symlink CLI en ~/bin (opcional, si ~/bin existe o se quiere crear) ─────────
read -rp "  ¿Agregar 'smartsearch' CLI a ~/bin? (s/n): " add_cli
if [[ "$add_cli" =~ ^[sS]$ ]]; then
  mkdir -p "$HOME/bin"
  ln -sf "$DIR/smartsearch" "$HOME/bin/smartsearch"
  echo "  ✓ Symlink creado: ~/bin/smartsearch"
  # agregar ~/bin al PATH si no está
  if ! grep -q 'HOME/bin' "$HOME/.zshrc" 2>/dev/null; then
    echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.zshrc"
    echo "  ✓ ~/bin agregado al PATH en ~/.zshrc"
  fi
fi

# ── LaunchAgent (servidor web en background) ───────────────────────────────────
read -rp "  ¿Instalar servidor web (auto-inicio en login, puerto 7823)? (s/n): " add_agent
if [[ "$add_agent" =~ ^[sS]$ ]]; then
  # desinstalar versión anterior si existe
  launchctl unload "$PLIST" 2>/dev/null || true

  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.smartsearch</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/smartsearch-ui.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/smartsearch.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/smartsearch.log</string>
</dict>
</plist>
EOF

  launchctl load "$PLIST"
  sleep 1

  if curl -s http://localhost:7823 | grep -q "smartsearch"; then
    echo "  ✓ Servidor corriendo → http://localhost:7823"
  else
    echo "  ⚠ Servidor instalado pero no responde aún. Revisa: tail -f /tmp/smartsearch.log"
  fi
fi

echo ""
echo "  Listo. Abre http://localhost:7823 en el browser."
echo "────────────────────────────────────────────────"
echo ""
