#include <SPI.h>
#include <Arduino.h>
#include <Wire.h>

#include <Adafruit_DRV2605.h>
#include <MAX30105.h>
#include <heartRate.h>

#define DRV_SDA 18  // DRV2605 - SDA no GPIO21
#define DRV_SCL 19  // DRV2605 - SCL no GPIO22
#define MAX_SDA 25  // MAX30105 - SDA no GPIO25 (alternativa: 32)
#define MAX_SCL 26  // MAX30105 - SCL no GPIO26 (alternativa: 33)

TwoWire I2C_DRV = TwoWire(0);  // I2C0 para DRV2605 vibrator
TwoWire I2C_MAX = TwoWire(1);  // I2C1 para MAX30105 heart bit

Adafruit_DRV2605 drv;
MAX30105 particleSensor;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
byte rateCount = 0;  // how many valid readings are stored in rates
float beatsPerMinute;
int beatAvg = 0;
long lastBeat = 0;
unsigned long lastPulse = 0;  // last time the vibrator pulsed

void setup() {
  Serial.begin(115200);
  delay(1000);

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
  // Heartbeat: "lub" - pause - "dub"
  drv.setWaveform(0, 1);          // Strong Click 100%  (lub)
  drv.setWaveform(1, 0x80 | 20);  // wait 200 ms
  drv.setWaveform(2, 18);         // Strong Click 80%   (dub)
  drv.setWaveform(3, 0);          // end of sequence

  Serial.println("Ready. Place your finger on the sensor.");
}
 
 void loop() {
    // Get IR value from sensor
    long irValue = particleSensor.getIR();  //Reading the IR value

    //If a finger is detected
    if (irValue > 50000) {
      if (checkForBeat(irValue) == true) {
        Serial.print("beat detected. ");

        // Calculate the BPM
        long delta = millis() - lastBeat;  // Measure duration between two beats
        lastBeat = millis();
        beatsPerMinute = 60 / (delta / 1000.0);  // Convert to beats per minute

        // Calculate the average BPM
        if (beatsPerMinute < 255 && beatsPerMinute > 20) { // Check if the BPM value is within a valid range
          rates[rateSpot++] = (byte)beatsPerMinute;  // Store this  reading in the array
          rateSpot %= RATE_SIZE;                     // Wrap variable
          if (rateCount < RATE_SIZE) rateCount++;

          // Calculate average of the BPM readings collected so far
          beatAvg = 0;
          for (byte x = 0; x < rateCount; x++)
            beatAvg += rates[x];
          beatAvg /= rateCount;

          delay(100);
        }

        //Print the IR value, current BPM value, and average BPM value to the serial monitor
        Serial.print("IR=");
        Serial.print(irValue);
        Serial.print(", BPM=");
        Serial.print(beatsPerMinute);
        Serial.print(", Avg BPM=");
        Serial.println(beatAvg);
      }
      else {
        // Serial.println("no beat detected.");
      }

      // Pulse the vibrator steadily at the average BPM, so missed beats don't break the rhythm
      if (beatAvg > 0 && millis() - lastPulse >= 60000UL / beatAvg) {
        lastPulse = millis();
        drv.go();
      }
    }
    else {
      // Serial.println("Place your index finger on the sensor with steady pressure.");

      // Finger lifted: stop pulsing and start a new average next time
      beatAvg = 0;
      rateCount = 0;
      rateSpot = 0;
      lastBeat = 0;
    }
 }
 