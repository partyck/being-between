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
2. open `/server` folder in a container.
3. create self-signed certificates in `server/certs` (the camera and Web Serial only work on HTTPS):
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -nodes -keyout certs/key.pem -out certs/cert.pem -days 365 -subj "/CN=localhost"
```
4. copy the fake videos to `server/src/static/videos/` (`fake-video-1.mp4`, `fake-video-2.mp4`, `fake-video-3.mp4`).
5. run server:
```bash
make run
```
6. open `https://<computer ip>:8080/?deviceid=1` on one installation and `/?deviceid=2` on the other.

To test the same container that runs on Cloud Run, run `make docker` from `server/` on the Mac (Docker is not available inside the dev container) and open `http://localhost:8080/?deviceid=1`. It runs without certificates: Chrome allows the camera and Web Serial on `localhost`.

## deploy server
The server runs on GCP Cloud Run, in `europe-west1` (Belgium). Run these from `server/`, on the Mac or in the dev container (both have gcloud, but each keeps its own login, so do the one-time steps where you deploy from).

one time:
1. create a gcloud configuration for the private Google account, so the deploy never uses the work account or project:
```bash
gcloud config configurations create being-between --no-activate
gcloud auth login --configuration=being-between
```
2. create the project and link it to a billing account (Cloud Run needs billing). This can also be done in the Google Cloud console:
```bash
gcloud projects create <project-id> --configuration=being-between
gcloud billing accounts list --configuration=being-between
gcloud billing projects link <project-id> --billing-account=<billing-account-id> --configuration=being-between
```
3. set `PROJECT` at the top of `server/Makefile` to `<project-id>`.
4. upload the fake videos from `server/src/static/videos/` to a public Cloud Storage bucket (run it again when the videos change). Cloud Run can't send files over 32 MiB, so on Cloud Run the server redirects `/videos/…` to the bucket:
```bash
make videos
```

deploy:
```bash
make deploy
```
The first time, gcloud asks to enable the Cloud Run, Cloud Build and Artifact Registry APIs and to create a repository for the image: answer yes. At the end it prints the service URL. The installations open `<url>/?deviceid=1` and `<url>/?deviceid=2`.

Cloud Run closes the connection to each installation every 60 minutes, and every deploy closes it too. The web app reconnects on its own, but the video can stutter for a moment, so avoid deploying while the exhibition is open.

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


