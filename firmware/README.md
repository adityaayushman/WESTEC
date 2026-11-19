# Plant gateway: hardware and firmware guide

**Status: reference design. Nothing here has been built or tested on real hardware.** The software it talks to (the `ingest_readings` function) is tested with the simulator in `tools/simulate-device.mjs`.

## What a gateway does
Reads the plant's sensors every minute, keeps readings in memory when the network drops, and sends them to the portal in batches every 5 minutes with its own device key. The portal turns them into trends and alerts.

## Suggested hardware (verify each part with a supplier before ordering)
| Need | Option | Notes |
|---|---|---|
| Controller | ESP32 dev board in an IP65 enclosure | Wi-Fi where there is coverage. At rural sites use a 4G router or a 4G-capable board. |
| Digester temperature | DS18B20 waterproof probe | Cheap, digital. Mount in a thermowell, not in the slurry. |
| Gas pressure | 0.5–4.5 V low-pressure transmitter (0–100 mbar range) | Use a divider to bring it to 3.3 V. |
| Gas flow | Biogas meter with a pulse output | Enter the pulses-per-m³ from its datasheet. |
| Methane, H₂S | Industrial gas-analyser modules or electrochemical cells | These are the costly and drift-prone items. Start without them: the portal works with temperature, pressure and flow alone. |
| pH | Industrial pH probe with an isolated amplifier | Needs regular calibration and cleaning. Optional. |
| Power | 12 V supply with a battery backup if the site loses power often | |

## Safety, wiring and approvals
- Equipment in or near biogas pipework is in a **hazardous (explosive) area**. Sensors and enclosures there must be suitably rated and installed by a qualified person. Do not mount a general-purpose ESP32 enclosure in a gas zone.
- The gateway only **measures**. It never switches gas or power equipment.
- This is not a gas-leak safety system. Keep separate, certified gas detectors.

## Install and configure
1. In the Wastec console: Customers, find the plant, click **New key**. Copy the key (shown once).
2. Open `esp32-gateway/esp32-gateway.ino`, fill in Wi-Fi and the project URL and anon key, and flash it.
3. Open the serial monitor (115200 baud) and type: `key <id>.<secret>`. The key is stored in flash.
4. Within about 5 minutes the plant's dashboard shows live values.
5. **Calibrate:** compare each sensor with a trusted reference and adjust the constants. Wrong calibration produces confident but wrong alerts.

## Known gaps in the sketch
- TLS certificate checking is left as a marked TODO. Use the ESP32 certificate bundle before any real deployment. Never ship with certificate checks off.
- Methane, H₂S and pH read functions are stubs that return nothing.
- Offline buffering is in RAM only: a reboot loses unsent readings. Moving it to flash is a straightforward improvement.
- No over-the-air updates, watchdog tuning or remote reconfiguration yet.
