#include <SPI.h>
#include <Arduino.h>
#include <Wire.h>

#include <WiFi.h>
#include <WiFiClientSecure.h>

#include <ArduinoJson.h>

#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Adafruit_DRV2605.h>
#include <MAX30105.h>
#include <heartRate.h>
#include "secrets.h"

#define DRV_SDA 18  // DRV2605 - SDA no GPIO21
#define DRV_SCL 19  // DRV2605 - SCL no GPIO22
#define MAX_SDA 25  // MAX30105 - SDA no GPIO25 (alternativa: 32)
#define MAX_SCL 26  // MAX30105 - SCL no GPIO26 (alternativa: 33)

TwoWire I2C_DRV = TwoWire(0);  // I2C0 para DRV2605 vibrator
TwoWire I2C_MAX = TwoWire(1);  // I2C1 para MAX30105 heart bit

SocketIOclient socketIO;
Adafruit_DRV2605 drv;
MAX30105 particleSensor;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
float beatsPerMinute;
int beatAvg = 0;
long lastBeat = 0;
float temperature;

void sendBeat() {
  Serial.println("Sending beat....");
  if (socketIO.isConnected()) {
    JsonDocument doc;
    JsonArray array = doc.to<JsonArray>();
    array.add("beat");
    JsonObject payload = array.add<JsonObject>();
    payload["beatsPerMinute"] = beatsPerMinute;
    payload["beatAvg"] = beatAvg;
    payload["deviceId"] = DEVICE_ID;
    String output;
    serializeJson(doc, output);
    
    bool send1 = socketIO.sendEVENT(output);
    Serial.print("Sent event: ");
    Serial.print(output);
    Serial.print(" responses: ");
    Serial.println(send1);
  } else {
    Serial.println("WebSocket is not connected. Trying to reconnect...");
  }
}
  
void socketIOEvent(socketIOmessageType_t type, uint8_t * payload, size_t length) {
  switch(type) {
      case sIOtype_DISCONNECT:
          Serial.printf("[IOc] Disconnected!\n");
          break;
      case sIOtype_CONNECT:
          Serial.printf("[IOc] Connected to url: %s\n", payload);
          socketIO.send(sIOtype_CONNECT, "/");
          break;
      case sIOtype_EVENT:
      {
          char * sptr = NULL;
          int id = strtol((char *)payload, &sptr, 10);
          Serial.printf("[IOc] get event: %s id: %d length: %u\n", payload, id, length);
          if(id) {
              payload = (uint8_t *)sptr;
          }
          JsonDocument doc;
          DeserializationError error = deserializeJson(doc, payload, length);
          if(error) {
              Serial.print(F("deserializeJson() failed: "));
              Serial.println(error.c_str());
              return;
          }

          String eventName = doc[0];
          Serial.printf("[IOc] event name: %s\n", eventName.c_str());
          JsonObject data = doc[1]; 
          int deviceId = data["deviceId"];
          if (deviceId != DEVICE_ID) {
            drv.go();
          }
      }
          break;
      case sIOtype_ACK:
          Serial.printf("[IOc] get ack: %u\n", length);
          break;
      case sIOtype_ERROR:
          Serial.printf("[IOc] get error: %u\n", length);
          break;
      case sIOtype_BINARY_EVENT:
          Serial.printf("[IOc] get binary: %u\n", length);
          break;
      case sIOtype_BINARY_ACK:
          Serial.printf("[IOc] get binary ack: %u\n", length);
          break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // --- WiFi Connection ---
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  // Check connection
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi connection failed!");
    // Stop further execution if WiFi is not connected
    while(true) { delay(1000); }
  }
 
  // server address, port and URL
  Serial.println("Connecting to Socket.IO server...");
  socketIO.begin(SOCKETIO_HOST, SOCKETIO_PORT, "/socket.io/?EIO=4");
  socketIO.setExtraHeaders("Connection: keep-alive");
  socketIO.onEvent(socketIOEvent);

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
    socketIO.loop();

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

          // Calculate average of BPM readings
          beatAvg = 0;
          for (byte x = 0; x < RATE_SIZE; x++)
            beatAvg += rates[x];
          beatAvg /= RATE_SIZE;

          delay(100);
        }

        sendBeat();
        //Print the IR value, current BPM value, and average BPM value to the serial monitor
        Serial.print("IR=");
        Serial.print(irValue);
        Serial.print(", BPM=");
        Serial.print(beatsPerMinute);
        Serial.print(", Avg BPM=");
        Serial.println(beatAvg);
      }
      else {
        Serial.println("no beat detected.");
      }
    }
    else {
      Serial.println("Place your index finger on the sensor with steady pressure.");
    }
 }
 