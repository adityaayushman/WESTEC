// Wastec plant gateway: REFERENCE SKETCH. Not compiled or run on hardware yet.
// Reads sensors every SAMPLE_SECONDS, buffers readings while offline, and posts them in batches to the
// Supabase function ingest_readings with this gateway's device key.
//
// Libraries (Arduino IDE / PlatformIO, board "ESP32 Dev Module", arduino-esp32 2.0.x or later):
//   OneWire, DallasTemperature (DS18B20 temperature probe)
// Fill in the CONFIG block, then calibrate every sensor against a reference before trusting the numbers.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

// ---------------- CONFIG ----------------
const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";
const char* SUPABASE_URL = "https://fausqyfyrqlxdnymayfv.supabase.co";   // your project URL
const char* SUPABASE_ANON_KEY = "PASTE_ANON_KEY";                         // public anon key, not the service_role key
// The device key ("<id>.<secret>", shown once when created in the console) is stored in flash.
// Set it once over serial:  key <paste key>   (see handleSerial below). Never hard-code it in a shared sketch.
const uint32_t SAMPLE_SECONDS = 60;
const uint32_t SEND_EVERY_SAMPLES = 5;          // send every 5 minutes
const int ONE_WIRE_PIN = 4;                     // DS18B20 data pin (4.7k pull-up to 3.3V)
const int FLOW_PULSE_PIN = 27;                  // gas meter reed or pulse output
const float PULSES_PER_M3 = 100.0;              // from the meter's datasheet
const int PRESSURE_ADC_PIN = 34;                // 0.5-4.5 V transmitter through a divider to 0-3.3 V
const float PRESSURE_MBAR_AT_0V5 = 0.0, PRESSURE_MBAR_AT_4V5 = 100.0, DIVIDER_RATIO = 0.6667;
const int MAX_BUFFER = 300;                     // readings kept while offline (RAM only; lost on reboot)
// ----------------------------------------

struct Reading { char kind[12]; float value; time_t ts; };
Reading buf[MAX_BUFFER];
int nbuf = 0;
volatile uint32_t pulses = 0;
uint32_t sampleCount = 0;
Preferences prefs;
String deviceKey;
OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature ds(&oneWire);
WiFiClientSecure tls;

void IRAM_ATTR onPulse() { pulses++; }

void push(const char* kind, float v) {
  if (isnan(v)) return;                          // sensor not fitted or read failed: skip, never send a fake zero
  if (nbuf == MAX_BUFFER) { memmove(buf, buf + 1, sizeof(Reading) * (MAX_BUFFER - 1)); nbuf--; }   // drop oldest
  strncpy(buf[nbuf].kind, kind, sizeof(buf[nbuf].kind) - 1); buf[nbuf].kind[sizeof(buf[nbuf].kind) - 1] = 0;
  buf[nbuf].value = v; buf[nbuf].ts = time(nullptr); nbuf++;
}

// ---- sensor adapters. Return NAN when the sensor is not fitted. ----
float readTemperatureC() { ds.requestTemperatures(); float t = ds.getTempCByIndex(0); return (t == DEVICE_DISCONNECTED_C || t < -20 || t > 90) ? NAN : t; }
float readPressureMbar() {
  float v = analogReadMilliVolts(PRESSURE_ADC_PIN) / 1000.0 / DIVIDER_RATIO;
  if (v < 0.4 || v > 4.6) return NAN;            // outside the transmitter's range: wiring fault
  return PRESSURE_MBAR_AT_0V5 + (v - 0.5) * (PRESSURE_MBAR_AT_4V5 - PRESSURE_MBAR_AT_0V5) / 4.0;
}
float readFlowM3PerHour(uint32_t windowSeconds) {
  noInterrupts(); uint32_t p = pulses; pulses = 0; interrupts();
  return (p / PULSES_PER_M3) * 3600.0 / windowSeconds;
}
float readMethanePct() { return NAN; }           // TODO: NDIR CH4 sensor (UART/analog); add calibration
float readH2SPpm()     { return NAN; }           // TODO: electrochemical H2S sensor after the scrubber
float readPH()         { return NAN; }           // TODO: pH probe with amplifier board; needs regular calibration

bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) delay(250);
  return WiFi.status() == WL_CONNECTED;
}

bool timeIsSet() { return time(nullptr) > 1700000000; }

bool sendBatch() {
  if (!nbuf || !deviceKey.length() || !connectWifi() || !timeIsSet()) return false;
  String body = "{\"p_device_key\":\"" + deviceKey + "\",\"p_readings\":[";
  int n = min(nbuf, 400);
  for (int i = 0; i < n; i++) {
    char iso[25]; struct tm t; gmtime_r(&buf[i].ts, &t); strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);
    if (i) body += ",";
    body += "{\"kind\":\"" + String(buf[i].kind) + "\",\"value\":" + String(buf[i].value, 3) + ",\"ts\":\"" + iso + "\"}";
  }
  body += "]}";
  HTTPClient http;
  // TODO before real use: load a CA certificate (or the ESP32 bundle) so the server is verified. With none set the connection fails closed.
  // Never use setInsecure() in production.
  http.begin(tls, String(SUPABASE_URL) + "/rest/v1/rpc/ingest_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  int code = http.POST(body);
  http.end();
  if (code == 200) { memmove(buf, buf + n, sizeof(Reading) * (nbuf - n)); nbuf -= n; return true; }
  Serial.printf("send failed: HTTP %d\n", code);
  return false;                                  // keep the readings and retry next time
}

void handleSerial() {                            // type:  key <id>.<secret>   to store the device key
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n'); line.trim();
  if (line.startsWith("key ")) { deviceKey = line.substring(4); deviceKey.trim(); prefs.putString("key", deviceKey); Serial.println("device key saved"); }
}

void setup() {
  Serial.begin(115200);
  prefs.begin("wastec", false); deviceKey = prefs.getString("key", "");
  ds.begin(); pinMode(FLOW_PULSE_PIN, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(FLOW_PULSE_PIN), onPulse, FALLING);
  connectWifi(); configTime(0, 0, "pool.ntp.org", "time.google.com");
  if (!deviceKey.length()) Serial.println("No device key. Type:  key <id>.<secret>");
}

void loop() {
  static uint32_t last = 0;
  handleSerial();
  if (millis() - last >= SAMPLE_SECONDS * 1000UL) {
    last = millis(); sampleCount++;
    if (timeIsSet()) {                           // timestamps need NTP; skip samples until the clock is set
      push("gas_flow", readFlowM3PerHour(SAMPLE_SECONDS)); push("temperature", readTemperatureC());
      push("pressure", readPressureMbar()); push("ch4", readMethanePct()); push("h2s", readH2SPpm()); push("ph", readPH());
    }
    if (sampleCount % SEND_EVERY_SAMPLES == 0) sendBatch();
  }
  delay(50);
}
