# Being, between

An interactive art installation by Gustiele Fistaról and Patrick Ortiz. There are two identical installations. Each one has a screen with a camera and a small device with a heartbeat sensor and a vibration motor. A visitor places a finger on the sensor, the installation looks for a visitor at the other installation, and the two see each other over live video. Later in the session, each visitor feels the other's heartbeat as vibrations. If nobody is at the other installation, a pre-recorded video and a fake 60 bpm heartbeat play instead.

`README.md` has the setup steps for people. `TODO.md` is the authors' own task list.

## Repo layout

- `server/`: the Flask-SocketIO server (`src/main.py`) and the web app it serves (`src/static/`). It has a dev container in `.devcontainer/`.
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

The server sends these to every client, and each client ignores events that carry its own `deviceId`. The code assumes exactly two installations. Each one opens `/?deviceid=1` or `/?deviceid=2`, and without the parameter `/` returns a 400.

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

- **Stack:** Flask + Flask-SocketIO on eventlet. It serves `static/` at `/` and reads the port from `$PORT` (default 8080). Run it from `server/src` with `python main.py`, normally inside the dev container (Python 3.11, port 8080 forwarded, gcloud CLI installed).
- **HTTPS is required.** The camera and Web Serial only work on HTTPS, so the server loads `certs/key.pem` and `certs/cert.pem` from `server/src/`. These are self-signed, not in the repo (`*.pem` is gitignored), and have to be generated locally.
- **SSL error in the log:** `ssl.SSLError: WRONG_VERSION_NUMBER` means a client connected with plain `http://`. The server has not crashed.
- **Web Serial:** works in Chrome and Edge only. The first time, the "Connect device" button pairs the ESP32. After that, `navigator.serial.getPorts()` reconnects it on page load and when the USB is plugged back in.
- **Media:** `static/videos/` (`fake-video-1..3.mp4`) is gitignored and has to be copied in by hand. The audio files are in git.
- **Frontend:** plain JS with no build step. The socket.io client 4.0.1 comes from a CDN. p5 is also loaded from a CDN, but nothing uses it yet.
- **Python dependencies:** `requirements.txt` lists many packages that `main.py` doesn't use (openai, opencv, numpy, grpc…). It only needs Flask, Flask-SocketIO and eventlet.
- **Style:** from the dev container settings. Python uses Black with line length 120 and isort with the black profile. JS and JSON use 2-space indents.

## Verifying changes

There are no automated tests.
- **Firmware:** run `pio run` in each firmware folder you changed.
- **Server:** run `python3 -m py_compile server/src/main.py`.
- **Real behaviour:** this needs the hardware and both installations, `/?deviceid=1` and `/?deviceid=2`. Say clearly when something was only compiled and not tested on the device or in a browser.

## Constraints

- **No recording.** The installation will show a sign saying no information from participants is recorded. Don't add anything that stores or logs video, images or heartbeat data.

## Planned deployment (not done yet)

- **Installations:** each one will be a Raspberry Pi 400 running Chromium in kiosk mode, with the ESP32 on USB.
  - The Linux user must be in the `dialout` group to open the serial port.
  - A Chromium policy `SerialAllowUsbDevicesForUrls` (in `/etc/chromium/policies/managed/`) can pre-approve the ESP32 so nobody has to click "Connect device". The CP2102 IDs in decimal are vendor 4292, product 60000.
  - `--autoplay-policy=no-user-gesture-required` lets the audio play without a click.
- **Server:** planned for GCP Cloud Run. `main.py` needs these changes first:
  - Run without the certificates and with debug off. Cloud Run handles HTTPS and forwards plain HTTP to the container.
  - Deploy with `--max-instances=1`, because the Socket.IO rooms live in memory, and with `--min-instances=1`.
  - Set `--timeout=3600`, because Cloud Run closes WebSockets at the request timeout.
  - Nobody has tested whether the WebRTC signalling survives a Socket.IO reconnect in the middle of a session.
