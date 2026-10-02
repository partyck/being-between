# Being, between
Gustiele Fistaról, Patrick Ortiz


## run server
requirements:
 - Docker desktop

execute:
1. run:
```bash
sh server/.devcontainer/preCreateCommand.sh
```
1. open `/server` folder in a container.
2. Add certificates to `server/src/certs` ([generate certificates](https://docs.tritondatacenter.com/public-cloud/getting-started/ssh-keys/generating-an-ssh-key-manually/manually-generating-your-ssh-key-in-mac-os-x)).
2. enter src folder:
```bash 
cd src/
```
3. run server:
```bash 
python main.py
```

## Device
The esp32 is an io board for the web app: it is connected by USB to the installation computer and the web app talks to it with [Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) (Chrome or Edge only). It sends `finger-on`, `finger-off` and `beat`, and vibrates when it receives `vibrate` (one message per line, 115200 baud).

The first time, click "Connect device" on the home screen and pick the esp32 port. The browser remembers it, so next time it connects on its own when the page loads or the device is plugged back in.

upload the code to the esp32 using Platformio.

requirements:
 - [PlatformIO Core](https://docs.platformio.org/en/latest/core/installation/index.html) (`brew install platformio`)

execute:
1. connect the esp32 by USB.
2. enter the firmware folder:
```bash
cd device/
```
3. build and upload:
```bash
pio run -t upload
```
4. (optional) open the serial monitor to see the logs:
```bash
pio device monitor
```

If the port is not detected, list the devices with `pio device list` and pass it with `--upload-port`, e.g. `pio run -t upload --upload-port /dev/cu.usbserial-0001`. To test only the sensor and the vibrator without WiFi, run the same commands from `test-connections/`.

## Layout
for laser cutter 3mm acrylic sheet use the following settings:
- for the cut use line with power max and min to 100% and 14 pass counts.
- for the engraving use fill with power max and min to 50% and 3 pass counts.


