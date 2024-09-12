/* 
 * Copyright (C) Derek Anderson and others
 *
 * This program is free software: you can redistribute it and/or modify 
 * it under the terms of the GNU General Public License as published by 
 * the Free Software Foundation, either version 3 of the License, or 
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful, 
 * but WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License 
 * along with this program.  If not, see <https://www.gnu.org/licenses/gpl.html>.
 * 
 * Much of this code Frankensteined from examples licenced in the
 * Public Domain and esp32-usb-serial's example code (LGPL)
 */


#include <Arduino.h>

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <WebSocketsServer.h>

#include "esp32_usb_serial.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "usb/cdc_acm_host.h"
#include "usb/usb_host.h"
#include "usb/vcp.hpp"

#define ESP_USB_SERIAL_BAUDRATE 115200
#define ESP_USB_SERIAL_DATA_BITS (8)
#define ESP_USB_SERIAL_PARITY (0)     // 0: 1 stopbit, 1: 1.5 stopbits, 2: 2 stopbits
#define ESP_USB_SERIAL_STOP_BITS (0)  // 0: None, 1: Odd, 2: Even, 3: Mark, 4: Space
#define ESP_USB_SERIAL_RX_BUFFER_SIZE 512
#define ESP_USB_SERIAL_TX_BUFFER_SIZE 128
#define ESP_USB_SERIAL_TASK_SIZE 4096
#define ESP_USB_SERIAL_TASK_CORE 1
#define ESP_USB_SERIAL_TASK_PRIORITY 10

#define WS_PORT 81

#define WIFI_SSID "WIFI_SSID"
#define WIFI_PASS "WIFI_PASS"


SemaphoreHandle_t device_disconnected_sem;
std::unique_ptr<CdcAcmDevice> vcp;
bool isConnected = false;
bool usbReady = false;
TaskHandle_t xHandle;

WiFiMulti WiFiMulti;
WebSocketsServer webSocket = WebSocketsServer(WS_PORT);

/**
 * recv from usb and send through ws.
 * send one ws mesg per line.
 * don't forget to strip \n.
 */
bool rx_callback(const uint8_t *data, size_t len, void *arg) {
  unsigned char* eol;
  while ((eol = (unsigned char*) memchr(data, '\n', len))!=NULL) {
    int i = eol - data;
    Serial.write(" <= ");
    Serial.write(data, i);
    Serial.write('\n');
    webSocket.broadcastTXT(data, i);
    data = eol+1;
    len -= i+1;
  }
  return true;
}

/**
 * usb device event callback
 */
void handle_event(const cdc_acm_host_dev_event_data_t *event, void *user_ctx) {
  switch (event->type) {
    case CDC_ACM_HOST_ERROR:
      Serial.printf("CDC-ACM error has occurred, err_no = %d\n", event->data.error);
      break;
    case CDC_ACM_HOST_DEVICE_DISCONNECTED:
      Serial.println("Device suddenly disconnected");
      xSemaphoreGive(device_disconnected_sem);
      isConnected = false;
      break;
    case CDC_ACM_HOST_SERIAL_STATE:
      Serial.printf("Serial state notif 0x%04X\n", event->data.serial_state.val);
      break;
    case CDC_ACM_HOST_NETWORK_CONNECTION:
      Serial.println("Network connection established");
      break;
    default:
      Serial.println("Unknown event");
      break;
  }
}

void connect_device() {

  if (!usbReady || isConnected) {
    return;
  }

  const cdc_acm_host_device_config_t dev_config = {
    .connection_timeout_ms = 5000,
    .out_buffer_size = ESP_USB_SERIAL_TX_BUFFER_SIZE,
    .in_buffer_size = ESP_USB_SERIAL_RX_BUFFER_SIZE,
    .event_cb = handle_event,
    .data_cb = rx_callback,
    .user_arg = NULL,
  };

  cdc_acm_line_coding_t line_coding = {
    .dwDTERate = ESP_USB_SERIAL_BAUDRATE,
    .bCharFormat = ESP_USB_SERIAL_STOP_BITS,
    .bParityType = ESP_USB_SERIAL_PARITY,
    .bDataBits = ESP_USB_SERIAL_DATA_BITS,
  };

  Serial.println("Opening VCP device...");
  vcp = std::unique_ptr<CdcAcmDevice>(esp_usb::VCP::open(&dev_config));

  if (vcp == nullptr) {
    Serial.println("Failed to open VCP device, retrying...");
    return;
  }

  vTaskDelay(10);

  Serial.println("USB detected.");

  if (vcp->line_coding_set(&line_coding) == ESP_OK) {
    Serial.println("USB connected.");
    isConnected = true;
    xSemaphoreTake(device_disconnected_sem, portMAX_DELAY);
    vTaskDelay(10);
    vcp = nullptr;
  } else {
    Serial.println("USB device not identified.");
  }

}

static void esp_usb_serial_connection_task(void *param) {
  while (1) {
    vTaskDelay(pdMS_TO_TICKS(10));
    if (!usbReady) {
      break;
    }
    connect_device();
  }
  vTaskDelete(NULL);
}

void setup_usb() {
  if (ESP_OK != usb_serial_init()) {
    Serial.println("Initialisation failed.");
    return;
  }
  if (ESP_OK != usb_serial_create_task()) {
    Serial.println("Task creation failed.");
    return;
  }
  device_disconnected_sem = xSemaphoreCreateBinary();
  if (device_disconnected_sem == NULL) {
    Serial.println("Semaphore creation failed.");
    return;
  }
  BaseType_t res = xTaskCreatePinnedToCore(
    esp_usb_serial_connection_task, "esp_usb_serial_task",
    ESP_USB_SERIAL_TASK_SIZE, NULL, ESP_USB_SERIAL_TASK_PRIORITY,
    &xHandle, ESP_USB_SERIAL_TASK_CORE);
  if (res != pdPASS || !xHandle) {
    Serial.println("Task creation failed.");
    return;
  }
  Serial.println("USB Serial connection task created successfully.");
  usbReady = true;
}

void send_data_usb(uint8_t *payload, size_t size) {
  unsigned char* data = (unsigned char*) calloc(1, size+1);
  memcpy(data, payload, size);
  data[size] = '\n';
  if (vcp && vcp->tx_blocking(data, size+1) == ESP_OK) {
    if (!(vcp && vcp->set_control_line_state(true, true) == ESP_OK)) {
      Serial.println("Failed set line.");
    }
  } else {
    Serial.println("Failed to send message.");
  }  
  Serial.print(" => ");
  Serial.write(data, size);
  Serial.println();
  free(data);
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_CONNECTED:
      {
        IPAddress ip = webSocket.remoteIP(num);
        Serial.printf("[%u] Connected from %d.%d.%d.%d path '%s'\n", num, ip[0], ip[1], ip[2], ip[3], payload);
      }
      break;
    case WStype_TEXT:
      send_data_usb(payload, length);
      break;
    case WStype_BIN:
      Serial.println("Binary websocket packet type not used.");
      break;
    case WStype_ERROR:
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      break;
  }
}

void setup_ws() {
  WiFiMulti.addAP(WIFI_SSID, WIFI_PASS);
  while (WiFiMulti.run() != WL_CONNECTED) {
    delay(100);
  }
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.print("Listening at ws://");
  Serial.print(WiFi.localIP());
  Serial.printf(":%i\n", WS_PORT);
}


void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  for (uint8_t t = 4; t > 0; t--) {
    Serial.printf("Flushing serial %d...\n", t);
    Serial.flush();
    delay(1000);
  }
  setup_ws();
  setup_usb();
}

void loop() {
  webSocket.loop();
}
