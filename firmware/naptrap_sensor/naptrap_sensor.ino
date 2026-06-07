/*
 * NapTrap — ESP32 Heart Rate Sensor Firmware
 *
 * Hardware : ESP32 + MAX30102 (I2C: SDA=21, SCL=22)
 * Libraries (install via Arduino Library Manager):
 *   - MAX30105 by SparkFun
 *   - ArduinoJson  (>= 6.x)
 *   - WebSockets by Markus Sattler
 *
 * Upload via esptool:
 *   python3 -m esptool --chip esp32 --port /dev/tty.usbserial-XXXX \
 *     --baud 921600 write_flash -z 0x10000 naptrap_sensor.ino.bin
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "MAX30105.h"
#include "heartRate.h"   // SparkFun beat-detection helper

// ─── User config ────────────────────────────────────────────────────────────
struct WiFiCredential {
  const char* ssid;
  const char* password;
};
WiFiCredential networks[] = {
  {"Sshrf", "hj919123"},
  {"Edwin", "66666666"},
};
const int NETWORK_COUNT = sizeof(networks) / sizeof(networks[0]);

// WebSocket server  (no trailing slash, no "wss://")
const char* WS_HOST = "naptrap-production.up.railway.app";
const uint16_t WS_PORT = 443;
// Path must include the user_id recognised by the backend
const char* WS_PATH = "/ws/sensor/fae7c340-53f9-4d29-87e8-a54ebd6227d6";
// ────────────────────────────────────────────────────────────────────────────

MAX30105      particleSensor;
WebSocketsClient ws;

// Beat-detection ring buffer (SparkFun algorithm)
const byte    RATE_SIZE = 4;
byte          rates[RATE_SIZE];
byte          rateSpot  = 0;
long          lastBeat  = 0;   // millis() of the previous confirmed beat
float         beatsPerMinute;
int           beatAvg;

// RR tracking
unsigned long prevBeatMillis = 0;   // wall-clock of last sent beat
bool          hasPrevBeat    = false;

// WiFi / WS state
bool wsConnected = false;

// ─── Forward declarations ────────────────────────────────────────────────────
void connectWiFi();
void wsEventHandler(WStype_t type, uint8_t* payload, size_t length);
void sendRR(uint32_t rrMs, uint32_t timestamp);

// ────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n[NapTrap] Booting...");

  // ── MAX30102 init ──
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[ERROR] MAX30102 not found. Check wiring (SDA=21, SCL=22).");
    while (true) { delay(500); }
  }
  particleSensor.setup();                   // default config
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeGreen(0); // green LED off — saves power

  Serial.println("[MAX30102] Sensor ready.");

  // ── WiFi + WebSocket ──
  connectWiFi();

  ws.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  ws.onEvent(wsEventHandler);
  ws.setReconnectInterval(3000);
  ws.enableHeartbeat(15000, 3000, 2); // ping every 15 s

  Serial.println("[WS] Connecting to WebSocket server...");
}

// ────────────────────────────────────────────────────────────────────────────
void loop() {
  ws.loop();   // must be called frequently

  long irValue = particleSensor.getIR();

  // Finger-on detection: IR > 50000 counts indicates contact
  if (irValue < 50000) {
    if (hasPrevBeat) {
      Serial.println("[HR] Finger removed — pausing.");
      hasPrevBeat = false;
    }
    return;
  }

  if (checkForBeat(irValue)) {
    unsigned long now = millis();

    // SparkFun BPM estimate (for display / sanity check only)
    long delta = now - lastBeat;
    lastBeat   = now;
    beatsPerMinute = 60.0f / (delta / 1000.0f);

    if (beatsPerMinute > 20 && beatsPerMinute < 255) {
      rates[rateSpot++ % RATE_SIZE] = (byte)beatsPerMinute;
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }

    // ── RR Interval calculation ──
    if (hasPrevBeat) {
      uint32_t rrMs = (uint32_t)(now - prevBeatMillis);

      // Reject physiologically impossible intervals (< 300 ms or > 2000 ms)
      if (rrMs >= 300 && rrMs <= 2000) {
        // Unix timestamp (seconds): use NTP if available, else millis()-based
        uint32_t ts = (uint32_t)(now / 1000UL);

        Serial.printf("[HR] RR=%u ms  BPM=%.1f  avgBPM=%d\n",
                      rrMs, beatsPerMinute, beatAvg);

        if (wsConnected) {
          sendRR(rrMs, ts);
        } else {
          Serial.println("[WS] Not connected — RR dropped.");
        }
      }
    }

    prevBeatMillis = now;
    hasPrevBeat    = true;
  }
}

// ────────────────────────────────────────────────────────────────────────────
void sendRR(uint32_t rrMs, uint32_t timestamp) {
  StaticJsonDocument<128> doc;
  doc["type"]      = "rr";
  doc["value"]     = rrMs;
  doc["timestamp"] = timestamp;

  char buf[128];
  serializeJson(doc, buf);
  ws.sendTXT(buf);

  Serial.printf("[WS] Sent: %s\n", buf);
}

// ────────────────────────────────────────────────────────────────────────────
void wsEventHandler(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      wsConnected = true;
      Serial.printf("[WS] Connected to wss://%s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);
      break;

    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("[WS] Disconnected — will retry.");
      break;

    case WStype_TEXT:
      Serial.printf("[WS] Server: %s\n", payload);
      break;

    case WStype_ERROR:
      Serial.println("[WS] Error.");
      break;

    default:
      break;
  }
}

// ────────────────────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  for (int i = 0; i < NETWORK_COUNT; i++) {
    Serial.print("Trying: ");
    Serial.println(networks[i].ssid);
    WiFi.begin(networks[i].ssid, networks[i].password);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
      return;
    }
    Serial.println("\nFailed, trying next...");
    WiFi.disconnect();
    delay(500);
  }
  Serial.println("[WiFi] All networks failed. Restarting...");
  ESP.restart();
}
