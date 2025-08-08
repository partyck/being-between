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

## Layout
for laser cutter 3mm acrylic sheet use the following settings:
- for the cut use line with power max and min to 100% and 14 pass counts.
- for the engraving use fill with power max and min to 50% and 3 pass counts.


