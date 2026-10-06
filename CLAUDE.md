# Being, between

An interactive art installation by Gustiele Fistaról and Patrick Ortiz. There are two identical installations. Each one has a screen with a camera and a small device with a heartbeat sensor and a vibration motor. A visitor places a finger on the sensor, the installation looks for a visitor at the other installation, and the two see each other over live video. Later in the session, each visitor feels the other's heartbeat as vibrations. If nobody is at the other installation, a pre-recorded video and a fake 60 bpm heartbeat play instead.

`README.md` has the setup steps for people. `TODO.md` is the authors' own task list.

## Repo layout

- `server/`: the Flask-SocketIO server (`src/main.py`) and the web app it serves (`src/static/`). `Makefile` runs it locally and deploys it to Cloud Run. It has a dev container in `.devcontainer/`.
- `device/`: ESP32 firmware for the installation (PlatformIO). It reads the sensor and drives the vibrator for the web app.
- `test-connections/`: separate ESP32 firmware for testing the sensor and the vibrator without the web app.
- `device-design/`: the enclosure. `design-cutting-file.lbrn2` is the main LightBurn laser file. `cut try.lbrn2` and `acrilic 5mm.lbrn2` are test cuts. There is one SVG per component, and `messurements.md` has the component sizes. The laser settings for 3 mm acrylic are in the README.

## How it fits together

```
ESP32 ⇄ USB (Web Serial) ⇄ web app in Chrome ⇄ Socket.IO server ⇄ other web app ⇄ USB ⇄ other ESP32
                              └──────── WebRTC video, peer to peer ────────┘
```

The ESP32 is only an IO board. It has no WiFi and keeps no session state. All the session logic is in `server/src/static/script.js`.

### Serial protocol (`device/src/main.cpp` ⇄ `script.js`)

The link runs at 115200 baud, with one plain-text message per line:
- ESP32 → web app: `finger-on`, `finger-off`, `beat`
- web app → ESP32: `vibrate`

To change or add a message, update both sides together: the firmware, and `onDeviceMessage()` / `vibrate()` in `script.js`.

### Socket.IO events (`script.js` ⇄ `main.py`)

- `join`, `leave`, `signal` → `peer_joined`, `peer_left`, `signal`: WebRTC signalling. Every client joins the room `video-room`.
- `start`: a visitor placed their finger.
- `experience-started`: an installation switched to the fake experience. The other installation goes back to its home screen.
- `beat`: the server sends it on as `motor`, and the other installation vibrates.

The server only accepts the two installations. Each one opens `/?deviceid=1` or `/?deviceid=2` plus `&key=<installation key>`, and `script.js` sends both in the Socket.IO `auth`. Anything else gets a 400 from `/` and is refused by `connect`. `device_sids` in `main.py` keeps one connection per device id: a new connection replaces the old one and disconnects it, because after a reload or a Cloud Run reconnect the old one stays open until its ping times out. A client the server disconnects this way does not reconnect on its own. The server sends `start`, `experience-started` and `beat` to every client except the sender, which leaves only the other installation. The device id is still needed to choose the fake videos.

### Session flow (`script.js`)

1. `finger-on` → `startSession()`: emits `start`, plays the connecting audio and waits `searchDuration` (20 s).
2. If the other installation sent `start` during the wait, the real experience starts with WebRTC video. If not, the fake experience plays a random video from `static/videos/`, chosen per device id.
3. After `espDuration` (43 s), real beats are sent to the other installation. In the fake experience, a 1 s timer vibrates the local device instead.
4. After `sessionDuration` (100 s), `endSession()` returns to the home screen. The visitor has to lift their finger and place it again to start a new session.

During a session, `finger-off` only shows "Please keep your finger on the device".

## Firmware

- **Board:** `esp32dev` with a CP2102 USB chip. On the Mac it appears as `/dev/cu.usbserial-0001`. `/dev/cu.SLAB_USBtoUART` is the same board, not a second one.
- **Wiring:** two separate I2C buses. The DRV2605 haptic driver is on `TwoWire(0)`, SDA 18 / SCL 19. The MAX30105/MAX30102 heart sensor is on `TwoWire(1)`, SDA 25 / SCL 26. Trust the `#define`s: the comment next to the DRV pins still says GPIO21/22.
- **Sensing:** a finger counts as present when IR > 50000. Beats come from SparkFun's `checkForBeat()`.
- **Haptics:** DRV2605 library 1 (ERM motors) in internal-trigger mode. A "lub-dub" sequence (Strong Click 100% → 200 ms wait → Strong Click 80%) is loaded once in `setup()`, and `drv.go()` plays it. The sequence lasts about 250 ms. If the motor feels weak, try `selectLibrary()` 2–5, which are timed for slower motors.
- **Duplicated sequence:** the same sequence is copied into `device/` and `test-connections/`. Keep the two in sync.
- **`test-connections/`:** it does not use the serial protocol. It prints `IR=…, BPM=…, Avg BPM=…` and pulses the vibrator itself at the average of the last 4 BPM readings, so the rhythm keeps going when a beat is missed.
- **Leftovers:** `include/secrets.h` in both firmware folders is from the old WiFi version. It is gitignored and unused.
- **Comments:** some code comments are in Portuguese.

Commands, run inside `device/` or `test-connections/`:

```bash
pio run                        # build
pio run -t upload -t monitor   # flash, then open the serial monitor
pio device list                # find the port; pass it with --upload-port if needed
```

- **Uploads fail while the port is open.** Only one program can use the serial port. If the serial monitor (or Chrome with the web app) has it open, the upload fails with "Invalid head of packet" / "serial noise". Close the other program first.
- **Upload stuck at "Connecting…":** hold the board's BOOT button.

## Server and web app

- **Stack:** Flask + Flask-SocketIO on eventlet. It serves `static/` at `/` and reads the port from `$PORT` (default 8080). Run it with `make run` from `server/` (same as `python main.py` in `server/src`), normally inside the dev container (Python 3.11, port 8080 forwarded, gcloud CLI installed). Debug is on unless `DEBUG=0`, which the Dockerfile sets.
- **HTTPS is required.** The camera and Web Serial only work on HTTPS (or on `localhost`). When `server/certs/key.pem` and `cert.pem` exist, the server uses them. The path is relative to `main.py` and outside `src/`, so they never end up in the Docker image. Without them it serves plain HTTP, which is what Cloud Run needs. The certificates are self-signed, not in the repo (`*.pem` is gitignored), and have to be generated locally (README).
- **SSL error in the log:** `ssl.SSLError: WRONG_VERSION_NUMBER` means a client connected with plain `http://`. The server has not crashed.
- **Installation key:** `$INSTALLATION_KEY`, kept as `INSTALLATION_KEY=<key>` in `server/.env`. The file is gitignored and outside `src/`, so it never ends up in the image. The Makefile reads it and passes it to `run`, `docker` and `deploy`, where it becomes a Cloud Run env var. `make deploy` refuses to run without it. Without a key, the server accepts any client with a valid device id.
- **Web Serial:** works in Chrome and Edge only. The first time, the "Connect device" button pairs the ESP32. After that, `navigator.serial.getPorts()` reconnects it on page load and when the USB is plugged back in.
- **Media:** `static/videos/` (`fake-video-1..3.mp4`, about 530 MB) is gitignored and has to be copied in by hand. It is also left out of the image and the Cloud Run upload (`.dockerignore`, `.gcloudignore`). Locally Flask serves the videos. When `$VIDEOS_URL` is set, `/videos/<file>` redirects there instead. On Cloud Run that is a public Cloud Storage bucket (`make videos`), because Cloud Run rejects HTTP/1 responses over 32 MiB. A page loaded from Cloud Run can't read videos from the installation's disk. The audio files are in git.
- **Frontend:** plain JS with no build step. The socket.io client 4.0.1 comes from a CDN. p5 is also loaded from a CDN, but nothing uses it yet.
- **Python dependencies:** `requirements.txt` has only Flask, Flask-SocketIO, eventlet and their dependencies, pinned. Flask 2.2 needs Werkzeug 2.2: Werkzeug 3 removed `url_quote` and breaks it.
- **Style:** from the dev container settings. Python uses Black with line length 120 and isort with the black profile. JS and JSON use 2-space indents.

## Verifying changes

There are no automated tests.
- **Firmware:** run `pio run` in each firmware folder you changed.
- **Server:** run `python3 -m py_compile server/src/main.py`. For changes to the image or the dependencies, run `docker build server/src` on the Mac, or `make docker` to run it on `http://localhost:8080`.
- **Real behaviour:** this needs the hardware and both installations, `/?deviceid=1` and `/?deviceid=2`. Say clearly when something was only compiled and not tested on the device or in a browser.

## Constraints

- **No recording.** The installation will show a sign saying no information from participants is recorded. Don't add anything that stores or logs video, images or heartbeat data.

## Deployment

- **Server:** GCP Cloud Run in `europe-west1` (Belgium), project `being-between-510716`. The region is `europe-west1` because Cloud Run domain mappings don't exist in every region, and the plan is to map `being-between.porpatrick.com` (DNS in Cloudflare). The videos bucket was created earlier in `europe-central2`, which doesn't matter, because browsers fetch the videos from it directly. Nothing has been deployed yet. `make videos` uploads the videos to a public bucket, and `make deploy` deploys from source with Cloud Build (README). The installations only open the Cloud Run URL.
  - Every gcloud command in the Makefile uses the gcloud configuration `being-between`, which has the authors' private Google account, and the `PROJECT` set in `server/Makefile` (or passed with `PROJECT=<id>`). It never uses the active gcloud configuration or project, because on the dev Mac those are a work account.
  - 1 vCPU: below 1 vCPU, Cloud Run allows only one request per instance, and each installation keeps a WebSocket open.
  - `--min-instances=1 --max-instances=1`, because the Socket.IO rooms live in memory.
  - `--timeout=3600`, because Cloud Run closes WebSockets at the request timeout, and 60 minutes is the maximum. Socket.IO then reconnects, the page sends `join` again, and the other installation rebuilds the WebRTC connection on `peer_joined`. Nobody has tested whether this works in the middle of a session.
  - The only ICE server is Google's public STUN server. On restrictive venue networks, WebRTC may need a TURN server, or Tailscale on both installations.
- **Installations (planned):** each one will be a Raspberry Pi 400 running Chromium in kiosk mode, with the ESP32 on USB.
  - The Linux user must be in the `dialout` group to open the serial port.
  - A Chromium policy `SerialAllowUsbDevicesForUrls` (in `/etc/chromium/policies/managed/`) can pre-approve the ESP32 for the Cloud Run URL so nobody has to click "Connect device". The CP2102 IDs in decimal are vendor 4292, product 60000.
  - `--autoplay-policy=no-user-gesture-required` lets the audio play without a click.
