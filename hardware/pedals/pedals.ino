#define MEASURE 0   // 1 = show distances so you can find the numbers, 0 = normal pedal output

// Fill these in after measuring: [gas, brake]
const float REST[2]  = {9.2, 8.5};   // distance in cm with the pedal up
const float PRESS[2] = {3.4, 3.8};     // distance in cm with the pedal at its stop

const int TRIG[2] = {4, 2};
const int ECHO[2] = {5, 3};
const unsigned long GAP_MS = 5;

float hist[2][3];
int hn[2] = {0, 0};
float filt[2] = {-1, -1};
float mn[2] = {999, 999};
float mx[2] = {-1, -1};
unsigned long lastPrint = 0;

float ping(int i) {
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
  if (cm < 0) return;
  hist[i][0] = hist[i][1]; hist[i][1] = hist[i][2]; hist[i][2] = cm;
  if (hn[i] < 3) hn[i]++;
  float m = (hn[i] < 3) ? cm : med3(hist[i][0], hist[i][1], hist[i][2]);
  filt[i] = (filt[i] < 0) ? m : filt[i] + 0.4 * (m - filt[i]);
  if (filt[i] < mn[i]) mn[i] = filt[i];
  if (filt[i] > mx[i]) mx[i] = filt[i];
}

int pedal(int i) {
  float span = REST[i] - PRESS[i];
  if (span < 0.5 || filt[i] < 0) return 0;
  float v = (REST[i] - filt[i]) / span;
  v = constrain(v, 0.0, 1.0);
  if (v < 0.03) v = 0;
  if (v > 0.97) v = 1;
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
}