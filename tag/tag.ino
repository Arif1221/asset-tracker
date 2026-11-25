#include <NimBLEDevice.h>

String deviceId() {
  uint64_t mac = ESP.getEfuseMac();

  char id[12];
  snprintf(id, sizeof(id), "TAG_%02X%02X%02X",
           (uint8_t)(mac >> 24),
           (uint8_t)(mac >> 32),
           (uint8_t)(mac >> 40));

  return String(id);
}

String ID;

void setup() {
  Serial.begin(115200);

  ID = deviceId();

  NimBLEDevice::init("");

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();

  NimBLEAdvertisementData data;
  data.setFlags(0x06);
  data.setName(ID.c_str());

  adv->setAdvertisementData(data);

  // Non-connectable advertising
  adv->setConnectableMode(BLE_GAP_CONN_MODE_NON);
  adv->setDiscoverableMode(BLE_GAP_DISC_MODE_GEN);

  // 100 ms advertising interval
  adv->setMinInterval(160);
  adv->setMaxInterval(160);

  adv->start();

  Serial.println("BLE Tag Started");
  Serial.println(ID);
}

void loop() {
  delay(60000);
}