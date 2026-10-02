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
upload the code to the esp32 using Platformio.

requirements:
 - [PlatformIO Core](https://docs.platformio.org/en/latest/core/installation/index.html) (`brew install platformio`)
 - `device/include/secrets.h` with `WIFI_SSID`, `WIFI_PASSWORD`, `SOCKETIO_HOST`, `SOCKETIO_PORT` and `DEVICE_ID` (this file is not committed).

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


