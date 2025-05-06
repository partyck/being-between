#include <SPI.h>
#include <Arduino.h>
#include <Wire.h>

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Adafruit_DRV2605.h>
 
const char* ssid = "SSID";
const char* password = "PASSWORD";
const char* address = "192.168.1.1";

#define SDA_PIN 21
#define SCL_PIN 22

 WiFiMulti wifi;
 SocketIOclient socketIO;
 Adafruit_DRV2605 drv;
  
 void socketIOEvent(socketIOmessageType_t type, uint8_t * payload, size_t length) {
  switch(type) {
      case sIOtype_DISCONNECT:
          Serial.printf("[IOc] Disconnected!\n");
          break;
      case sIOtype_CONNECT:
          Serial.printf("[IOc] Connected to url: %s\n", payload);

          // join default namespace (no auto join in Socket.IO V3)
          socketIO.send(sIOtype_CONNECT, "/");
          break;
      case sIOtype_EVENT:
      {
          char * sptr = NULL;
          int id = strtol((char *)payload, &sptr, 10);
          Serial.printf("[IOc] get event: %s id: %d\n", payload, id);
          if(id) {
            payload = (uint8_t *)sptr;
          }
          DynamicJsonDocument doc(1024);
          DeserializationError error = deserializeJson(doc, payload, length);
          if(error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.c_str());
            return;
          }

          String eventName = doc[0];
          Serial.printf("[IOc] event name: %s\n", eventName.c_str());
          
          long beats = doc[1]["data"];
          if (beats > 100000) {
            drv.go();
          }

          // Message Includes a ID for a ACK (callback)
          if(id) {
              // create JSON message for Socket.IO (ack)
              DynamicJsonDocument docOut(1024);
              JsonArray array = docOut.to<JsonArray>();

              // add payload (parameters) for the ack (callback function)
              JsonObject param1 = array.createNestedObject();
              param1["now"] = millis();

              // JSON to String (serializion)
              String output;
              output += id;
              serializeJson(docOut, output);

              // Send event
              socketIO.send(sIOtype_ACK, output);
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
    // Serial.begin(921600);
    Serial.begin(115200);
    
    //Serial.setDebugOutput(true);
    Serial.setDebugOutput(true);
    
    Serial.println();
    Serial.println();
    Serial.println();
 
    for(uint8_t t = 4; t > 0; t--) {
        Serial.printf("[SETUP] BOOT WAIT %d...\n", t);
        Serial.flush();
        delay(1000);
    }
    
    wifi.addAP(ssid, password);
    
    //WiFi.disconnect();
    while(wifi.run() != WL_CONNECTED) {
        delay(100);
    }
 
    // server address, port and URL
    //  webSocket.begin(address, 8080, "/socket");
    socketIO.begin(address, 8080, "/socket.io/?EIO=4");

    // event handler
    socketIO.onEvent(socketIOEvent);

    // setup motor
    drv.begin();
    
    // I2C trigger by sending 'go' command 
    drv.setMode(DRV2605_MODE_INTTRIG); // default, internal trigger when sending GO command

    drv.selectLibrary(1);
    drv.setWaveform(1, 52);  // Pulsing Strong 1 – 100%
 }
 
 unsigned long messageTimestamp = 0;
 void loop() {
    socketIO.loop();

    uint64_t now = millis();

    if(now - messageTimestamp > 2000) {
        messageTimestamp = now;

        // create JSON message for Socket.IO (event)
        DynamicJsonDocument doc(1024);
        JsonArray array = doc.to<JsonArray>();

        // add event name
        // Hint: socket.on('event_name', ....
        array.add("esp");

        // add payload (parameters) for the event
        JsonObject param1 = array.createNestedObject();
        param1["data"] = "hi";

        // JSON to String (serialization)
        String output;
        serializeJson(doc, output);

        // Send event
        // socketIO.sendEVENT(output);

        // Print JSON for debugging
        // Serial.println(output);
    }
 }
 