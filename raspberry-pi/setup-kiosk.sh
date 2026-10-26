#!/usr/bin/env bash
# Sets up a Raspberry Pi as an installation: at every boot it logs into the desktop and opens
# the web app in Chromium, full screen. Run it on the Pi as the user that logs in, not as root,
# and run it again to change the url:
#   bash setup-kiosk.sh 'https://being-between.porpatrick.com/?deviceid=1&key=<key>'
set -euo pipefail

url="${1:-}"
if [[ ! "$url" =~ ^https?://[^/?#]+ ]]; then
  echo "usage: bash $0 '<url>'   (keep the quotes: the url contains &)" >&2
  exit 1
fi
origin="${BASH_REMATCH[0]}"

if [[ $EUID -eq 0 ]]; then
  echo "Run it as the user that logs into the desktop, not as root. It asks for sudo itself." >&2
  exit 1
fi

chromium=$(command -v chromium || command -v chromium-browser || true)
if [[ -z "$chromium" ]]; then
  echo "Chromium is not installed: sudo apt install chromium" >&2
  exit 1
fi

if ! command -v labwc >/dev/null && ! command -v wayfire >/dev/null && ! command -v lxsession >/dev/null; then
  echo "No desktop found. This needs Raspberry Pi OS with desktop, not Lite." >&2
  exit 1
fi

# The script that the desktop runs at login.
launcher="$HOME/.local/bin/being-between-kiosk"
mkdir -p "$(dirname "$launcher")"
{
  echo '#!/usr/bin/env bash'
  echo '# Written by raspberry-pi/setup-kiosk.sh in the being-between repo.'
  printf 'url=%q\n' "$url"
  printf 'origin=%q\n' "$origin"
  printf 'chromium=%q\n' "$chromium"
  cat <<'EOF'
# A profile of its own, so that this is always a new Chromium process and the loop below waits for it.
profile="$HOME/.config/being-between-kiosk"

# Only one launcher at a time, in case the desktop starts it twice.
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/being-between-kiosk.lock"
flock -n 9 || exit 0

# Wait for the network (up to about a minute), so the page doesn't open on an error.
for _ in {1..30}; do
  curl -s -o /dev/null --max-time 5 "$origin" && break
  sleep 2
done

# Open Chromium again if it closes or crashes.
while true; do
  # Don't ask to restore the pages after the power was cut.
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$profile/Default/Preferences" 2>/dev/null || true
  "$chromium" --kiosk --user-data-dir="$profile" --no-first-run --noerrdialogs --password-store=basic \
    --autoplay-policy=no-user-gesture-required --disable-features=Translate \
    --check-for-update-interval=31536000 "$url"
  sleep 2
done
EOF
} >"$launcher"
chmod +x "$launcher"

# Start it at login. The Raspberry Pi OS desktops run ~/.config/autostart.
mkdir -p "$HOME/.config/autostart"
cat >"$HOME/.config/autostart/being-between-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Being, between
Exec=$launcher
Terminal=false
EOF
# In case this labwc doesn't run ~/.config/autostart. The lock stops a second launcher.
if [[ -f /etc/xdg/labwc/autostart ]] && ! grep -q xdg-autostart /etc/xdg/labwc/autostart; then
  mkdir -p "$HOME/.config/labwc"
  touch "$HOME/.config/labwc/autostart"
  grep -qF "$launcher" "$HOME/.config/labwc/autostart" || echo "$launcher &" >>"$HOME/.config/labwc/autostart"
fi

# Let the page use the camera and the ESP32 (CP2102: vendor 4292, product 60000) without asking.
policy=$(
  cat <<EOF
{
  "VideoCaptureAllowedUrls": ["$origin"],
  "SerialAllowUsbDevicesForUrls": [{ "devices": [{ "vendor_id": 4292, "product_id": 60000 }], "urls": ["$origin"] }]
}
EOF
)
for dir in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  sudo mkdir -p "$dir"
  echo "$policy" | sudo tee "$dir/being-between.json" >/dev/null
done

sudo usermod -aG dialout "$USER"                # to open the ESP32's serial port
sudo raspi-config nonint do_boot_behaviour B4   # boot to the desktop, logged in as this user
sudo raspi-config nonint do_blanking 1          # never turn the screen off

echo "Done. Reboot with: sudo reboot"
echo "To leave the kiosk for maintenance, from SSH: pkill -f being-between-kiosk"
