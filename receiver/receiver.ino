#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#include "secrets.h"  // WIFI_SSID, WIFI_PASS, DB_URL: copy secrets.example.h to secrets.h (git ignores it)

// ---- Config (same for all receivers) ----
const char* FW_VER    = "1.3";
const int   MAX_TAGS  = 16;
const unsigned long REPORT_MS    = 1000;   // one reading per tag per second
const unsigned long HEARTBEAT_MS = 10000;
const int IDLE_FREE_S = 60;                     // free a tag's slot after this many silent seconds
const unsigned long RESTART_AFTER_MS = 120000;  // uploads failing this long: restart the board

String RX_ID;
// Filled by the BLE task, read and reset by loop(): every access goes through `lock`
struct Tag { char name[12]; int maxRssi; long sumRssi; int count; int idle; };
Tag tags[MAX_TAGS];
int tagCount = 0;
portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;

BLEScan* scan;
WiFiClientSecure tls;
HTTPClient http;
unsigned long lastReport = 0, lastBeat = 0, failingSince = 0;
volatile bool scanning = false;
void scanEnded(BLEScanResults) { scanning = false; }  // the stack stopped the scan; loop() restarts it

String deviceId() {
  uint64_t mac = ESP.getEfuseMac();
  char id[12];
  snprintf(id, sizeof(id), "RX_%02X%02X%02X",
           (uint8_t)(mac >> 24), (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));
  return String(id);
}

class CB : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice d) {
    if (!d.haveName()) return;  // most phones and watches send no name: skip them before copying anything
    String name = d.getName().c_str();
    if (!name.startsWith("TAG_") || name.length() >= sizeof(tags[0].name)) return;
    int rssi = d.getRSSI();
    portENTER_CRITICAL(&lock);
    int i = 0;
    while (i < tagCount && strcmp(tags[i].name, name.c_str()) != 0) i++;
    if (i == tagCount && tagCount < MAX_TAGS) {
      strcpy(tags[i].name, name.c_str());
      tags[i].maxRssi = -127; tags[i].sumRssi = 0; tags[i].count = 0; tags[i].idle = 0;
      tagCount++;
    }
    if (i < tagCount) {
      tags[i].count++;
      tags[i].sumRssi += rssi;
      if (rssi > tags[i].maxRssi) tags[i].maxRssi = rssi;
    }
    portEXIT_CRITICAL(&lock);
  }
};

void connectWiFi() {
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) { delay(250); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " OK" : " not yet (will auto-retry)");
}

int patch(const String& path, const String& json) {
  if (WiFi.status() != WL_CONNECTED) { Serial.println("WiFi down, skip"); return -1; }
  http.begin(tls, String(DB_URL) + path);
  http.addHeader("Content-Type", "application/json");
  int code = http.PATCH(json);
  http.end();
  return code;
}

// A router reboot can leave Wi-Fi or the TLS session stuck for good; a restart clears it
void trackUpload(int code) {
  if (code >= 200 && code < 300) { failingSince = 0; return; }
  if (!failingSince) failingSince = millis();
  else if (millis() - failingSince > RESTART_AFTER_MS) { Serial.println("Uploads failing for 2 min, restarting"); delay(100); ESP.restart(); }
}

void heartbeat() {
  String json = String("{\"lastSeen\":{\".sv\":\"timestamp\"},\"ip\":\"") + WiFi.localIP().toString() +
                "\",\"wifiRssi\":" + WiFi.RSSI() + ",\"fw\":\"" + FW_VER + "\"}";
  int code = patch("/receivers/" + RX_ID + ".json", json);
  Serial.printf("HEARTBEAT %d\n", code);
  trackUpload(code);
}

// Copy this second's counts out under the lock, then build and send the upload without it,
// so the BLE task keeps scanning while the (slow) HTTPS request runs.
void report() {
  Tag snap[MAX_TAGS];
  int n;
  portENTER_CRITICAL(&lock);
  n = tagCount;
  memcpy(snap, tags, sizeof(Tag) * n);
  for (int i = 0; i < tagCount; i++) {
    tags[i].idle = tags[i].count ? 0 : tags[i].idle + 1;
    // slots are never reused otherwise, so after 16 different tags a new one would be ignored for good
    if (tags[i].idle >= IDLE_FREE_S) { tags[i] = tags[--tagCount]; i--; continue; }
    tags[i].maxRssi = -127; tags[i].sumRssi = 0; tags[i].count = 0;
  }
  portEXIT_CRITICAL(&lock);

  String json = "{";
  bool any = false;
  for (int i = 0; i < n; i++) {
    if (snap[i].count == 0) continue;
    // rssi = strongest packet (what older calibrations used); avg = mean of all packets,
    // which doesn't get stronger just because more packets were caught
    float avg = (float)snap[i].sumRssi / snap[i].count;
    if (any) json += ",";
    json += String("\"") + snap[i].name + "\":{\"rssi\":" + snap[i].maxRssi + ",\"avg\":" + String(avg, 1) +
            ",\"pkts\":" + snap[i].count + ",\"ts\":{\".sv\":\"timestamp\"}}";
    any = true;
  }
  json += "}";
  if (any) {
    int code = patch("/live/" + RX_ID + ".json", json);
    Serial.printf("PATCH %d %s\n", code, json.c_str());
    trackUpload(code);
  }
}

void setup() {
  Serial.begin(115200);
  RX_ID = deviceId();
  Serial.printf("\nReceiver ID: %s  fw %s\n", RX_ID.c_str(), FW_VER);

  WiFi.mode(WIFI_STA);
  connectWiFi();
  tls.setInsecure();
  http.setReuse(true);

  BLEDevice::init("");
  scan = BLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new CB(), true);  // true = every packet, not just new devices (nothing is stored)
  scan->setActiveScan(false);
  scan->setInterval(100);
  scan->setWindow(99);
  scanning = scan->start(0, scanEnded, false);          // 0 = scan forever in the background
}

void loop() {
  if (!scanning) scanning = scan->start(0, scanEnded, false);

  if (millis() - lastReport >= REPORT_MS) {
    lastReport += REPORT_MS;
    if (millis() - lastReport >= REPORT_MS) lastReport = millis();  // fell behind (slow upload): don't burst
    report();
  }
  if (millis() - lastBeat > HEARTBEAT_MS || lastBeat == 0) {
    heartbeat();
    lastBeat = millis();
  }
  delay(10);
}
