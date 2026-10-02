#include <SPI.h>
#include <Arduino.h>
#include <Wire.h>

#include <Adafruit_DRV2605.h>
#include <MAX30105.h>
#include <heartRate.h>

// The esp32 is just an io board for the web app, connected by USB (Web Serial).
// Messages are one per line, at 115200 baud:
//   esp32 -> web app: "finger-on", "finger-off", "beat"
//   web app -> esp32: "vibrate"

#define DRV_SDA 18  // DRV2605 - SDA no GPIO21
#define DRV_SCL 19  // DRV2605 - SCL no GPIO22
#define MAX_SDA 25  // MAX30105 - SDA no GPIO25 (alternativa: 32)
#define MAX_SCL 26  // MAX30105 - SCL no GPIO26 (alternativa: 33)

TwoWire I2C_DRV = TwoWire(0);  // I2C0 para DRV2605 vibrator
TwoWire I2C_MAX = TwoWire(1);  // I2C1 para MAX30105 heart bit

Adafruit_DRV2605 drv;
MAX30105 particleSensor;

int fingerOn = -1;  // -1 so the first reading is always sent
String command = "";

void readCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      command.trim();
      if (command == "vibrate") {
        drv.go();
      }
      command = "";
    }
    else {
      command += c;
    }
  }
}

void setup() {
  Serial.begin(115200);

  // initializing vibrator
  I2C_DRV.begin(DRV_SDA, DRV_SCL, 400000);
  drv = Adafruit_DRV2605();
  if (!drv.begin(&I2C_DRV)) {
    Serial.println("DRV2605 not found!");
    while (1);
  }

  // setup heartbit sensor
  I2C_MAX.begin(MAX_SDA, MAX_SCL, 400000);

  if (!particleSensor.begin(I2C_MAX, I2C_SPEED_FAST)) {
    Serial.println("MAX30105 not found!");
    while(1);
  }

  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeGreen(0);

  drv.selectLibrary(1);
  drv.setMode(DRV2605_MODE_INTTRIG);
  drv.setWaveform(0, 84); // Efeito háptico
}

void loop() {
  readCommands();

  // Get IR value from sensor
  long irValue = particleSensor.getIR();  //Reading the IR value

  //If a finger is detected
  int finger = irValue > 50000 ? 1 : 0;
  if (finger != fingerOn) {
    fingerOn = finger;
    Serial.println(fingerOn ? "finger-on" : "finger-off");
  }

  if (fingerOn && checkForBeat(irValue) == true) {
    Serial.println("beat");
  }
}
