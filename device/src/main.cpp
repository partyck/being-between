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

bool isStarted = false;
bool sentStart = false;
bool fingerMisplaced = false;

void sendJoined() {
  if (!socketIO.isConnected()) {
    Serial.println("WebSocket is not connected. Trying to reconnect...");
    return;
  }
  Serial.println("Sending joined....");
  JsonDocument doc;
  JsonArray array = doc.to<JsonArray>();
  array.add("esp-joined");
  JsonObject payload = array.add<JsonObject>();
  payload["deviceId"] = DEVICE_ID;
  String output;
  serializeJson(doc, output);
  
  bool send1 = socketIO.sendEVENT(output);
  Serial.print("Sent event: ");
  Serial.print(output);
  Serial.print(" responses: ");
  Serial.println(send1);
}
void sendBeat() {
  if (!socketIO.isConnected()) {
    Serial.println("WebSocket is not connected. Trying to reconnect...");
    return;
  }
  Serial.println("Sending beat....");
  JsonDocument doc;
  JsonArray array = doc.to<JsonArray>();
  array.add("beat");
  JsonObject payload = array.add<JsonObject>();
  payload["deviceId"] = DEVICE_ID;
  String output;
  serializeJson(doc, output);
  
  bool send1 = socketIO.sendEVENT(output);
  Serial.print("Sent event: ");
  Serial.print(output);
  Serial.print(" responses: ");
  Serial.println(send1);
}

void sendStart() {
  if (!socketIO.isConnected()) {
    Serial.println("WebSocket is not connected. Trying to reconnect...");
    return;
  }
  if (!sentStart) {
    Serial.println("Sending Start....");
    JsonDocument doc;
    JsonArray array = doc.to<JsonArray>();
    array.add("start");
    JsonObject payload = array.add<JsonObject>();
    payload["deviceId"] = DEVICE_ID;
    String output;
    serializeJson(doc, output);
    
    bool send1 = socketIO.sendEVENT(output);
    sentStart = true;
    Serial.print("Sent event: ");
    Serial.print(output);
    Serial.print(" responses: ");
    Serial.println(send1);
  }
}

void sendFingerPlacement(bool changed) {
  if (!socketIO.isConnected()) {
    Serial.println("WebSocket is not connected. Trying to reconnect...");
    return;
  }
  if (sentStart && changed != fingerMisplaced) {
    Serial.println("Sending finger misplaced....");
    fingerMisplaced = changed;
    JsonDocument doc;
    JsonArray array = doc.to<JsonArray>();
    array.add("finger-misplaced");
    JsonObject payload = array.add<JsonObject>();
    payload["deviceId"] = DEVICE_ID;
    payload["fingerMisplaced"] = fingerMisplaced;
    String output;
    serializeJson(doc, output);
    
    bool send1 = socketIO.sendEVENT(output);
    Serial.print("Sent event: ");
    Serial.print(output);
    Serial.print(" responses: ");
    Serial.println(send1);
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
          sendJoined();
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
          JsonObject data = doc[1]; 
          int deviceId = data["deviceId"];
          if (deviceId == DEVICE_ID) {
            if (eventName == "start-beat") {
              Serial.println("start-beat");
              isStarted = true;
            }
            else if (eventName == "stop") {
              Serial.println("this stop");
              isStarted = false;
              sentStart = false;
              fingerMisplaced = false;
            }
          }
          else {
            if (eventName == "motor") {
              Serial.println("motor!");
              drv.go();
            }
            if (eventName == "stop") {
              Serial.println("other stop");
            }
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
  // socketIO.begin(SOCKETIO_HOST, SOCKETIO_PORT, "/socket.io/?EIO=4");
  socketIO.beginSSL(SOCKETIO_HOST, SOCKETIO_PORT, "/socket.io/?EIO=4");
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
      sendStart();
      sendFingerPlacement(false);
      if (checkForBeat(irValue) == true) {
        Serial.print("beat detected. ");
        Serial.print("IR=");
        Serial.println(irValue);
        if (isStarted) {
          sendBeat();
        }
      }
    }
    else {
      sendFingerPlacement(true);
    }
 }
 