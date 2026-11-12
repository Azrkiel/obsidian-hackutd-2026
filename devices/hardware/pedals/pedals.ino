#define MEASURE 0   // 1 = show distances so you can find the numbers, 0 = normal pedal output

// [gas, brake]: distance in cm with the pedal up / at its stop
const float REST[2]  = {9.2, 8.5};
const float PRESS[2] = {4.0, 3.8};   // gas re-measured on the game PC: rest 9.4, full press 3.9

const int TRIG[2] = {4, 2};   // [gas sensor, brake sensor]
const int ECHO[2] = {5, 3};
const unsigned long GAP_MS = 3;   // wait after each ping; raise to 4 or 5 if readings spike

const unsigned long LOST_MS = 120;  // no good echo for this long -> that pedal reads 0 (never freeze)
const float MIN_CM = 2.0;           // HC-SR04 cannot measure closer than ~2 cm

float hist[2][3];
int hn[2] = {0, 0};
float filt[2] = {-1, -1};
float mn[2] = {999, 999};
float mx[2] = {-1, -1};
unsigned long lastGood[2] = {0, 0};
unsigned long lastWarn = 0;
unsigned long lastPrint = 0;

float ping(int i) {
  if (digitalRead(ECHO[i]) == HIGH) return -1.0;  // still busy with the last ping: don't re-trigger
  digitalWrite(TRIG[i], LOW);  delayMicroseconds(2);
  digitalWrite(TRIG[i], HIGH); delayMicroseconds(10);
  digitalWrite(TRIG[i], LOW);
  unsigned long us = pulseIn(ECHO[i], HIGH, 4000);
  return (us == 0) ? -1.0 : us / 58.0;
}

float med3(float a, float b, float c) {
  if (a > b) { float t = a; a = b; b = t; }
  if (b > c) { float t = b; b = c; c = t; }
  if (a > b) { float t = a; a = b; b = t; }
  return b;
}

void update(int i, float cm) {
  if (cm < MIN_CM) return;                  // timeout / impossible reading: ignore (pedal() handles loss)
  lastGood[i] = millis();
  hist[i][0] = hist[i][1]; hist[i][1] = hist[i][2]; hist[i][2] = cm;
  if (hn[i] < 3) hn[i]++;
  float m = (hn[i] < 3) ? cm : med3(hist[i][0], hist[i][1], hist[i][2]);
  if (filt[i] < 0) {
    filt[i] = m;
  } else {
    // fast when the pedal moves, smooth when it is still
    float a = (fabs(m - filt[i]) > 1.0) ? 0.8 : 0.3;
    filt[i] += a * (m - filt[i]);
  }
  if (filt[i] < mn[i]) mn[i] = filt[i];
  if (filt[i] > mx[i]) mx[i] = filt[i];
}

int pedal(int i) {
  float span = REST[i] - PRESS[i];
  if (span < 0.5 || filt[i] < 0) return 0;
  if (millis() - lastGood[i] > LOST_MS) return 0;   // sensor silent: release, never hold the last value
  float v = (REST[i] - filt[i]) / span;
  v = constrain(v, 0.0, 1.0);
  if (v < 0.03) v = 0;                      // dead zone at the top
  if (v > 0.97) v = 1;                      // full at the bottom stop
  return (int)(v * 1000);
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 2; i++) {
    pinMode(TRIG[i], OUTPUT);
    pinMode(ECHO[i], INPUT);
    digitalWrite(TRIG[i], LOW);
  }
}

void loop() {
  update(0, ping(0)); delay(GAP_MS);
  update(1, ping(1)); delay(GAP_MS);

#if MEASURE
  if (millis() - lastPrint >= 250) {
    lastPrint = millis();
    Serial.print("now "); Serial.print(filt[0], 1); Serial.print(" / "); Serial.print(filt[1], 1);
    Serial.print("   min "); Serial.print(mn[0], 1); Serial.print(" / "); Serial.print(mn[1], 1);
    Serial.print("   max "); Serial.print(mx[0], 1); Serial.print(" / "); Serial.println(mx[1], 1);
  }
#else
  Serial.print(pedal(0)); Serial.print(","); Serial.println(pedal(1));
#endif
  // once a second, say which sensor is silent ("#" lines are ignored by the receivers)
  if (millis() - lastWarn >= 1000) {
    for (int i = 0; i < 2; i++) {
      if (millis() - lastGood[i] > LOST_MS) {
        lastWarn = millis();
        Serial.println(i == 0 ? "#lost gas" : "#lost brake");
      }
    }
  }
}
