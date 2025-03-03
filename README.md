# 🚀 MPU6050 Gyroscope Monitoring System

## Demo
[!me](https://github.com/Harsh08Singh/hKhR-Rabbit/blob/main/assets/analysis.gif)

https://github.com/Harsh08Singh/hKhR-Rabbit/blob/main/assets/cipherState.gif
https://github.com/Harsh08Singh/hKhR-Rabbit/blob/main/assets/drone2.gif
https://github.com/Harsh08Singh/hKhR-Rabbit/blob/main/assets/drone.gif
https://github.com/Harsh08Singh/hKhR-Rabbit/blob/main/assets/overview.gif

## 🔥 Overview

Welcome to the **MPU6050 Gyroscope Monitoring System**, a cutting-edge real-time motion tracking solution! This system, powered by a **Raspberry Pi** and an **MPU6050 sensor**, securely transmits gyroscope, accelerometer, and temperature data using **Rabbit Cipher encryption**. With a sleek web interface, you can visualize sensor data like never before! 🌐📊

---

## 🏗️ Architecture

The system is built on three core layers:

### 🔨 **1. Hardware Layer**

- **MPU6050 Sensor** – Captures motion, acceleration, and temperature data.
- **Raspberry Pi** – Acts as the brain, interfacing with the sensor via I2C.

### 💻 **2. Raspberry Pi Services**

- **WiFi Access Point** – Hosts a dedicated network (`RaspberryPi_Gyro`).
- **Rabbit Cipher Encryption** – Secures sensor data before transmission.
- **Flask Web Server** – Exposes an API endpoint (`/gyro`) for data retrieval.
- **System Services:**
  - `hostapd` – Manages the WiFi network.
  - `dnsmasq` – Handles DHCP and DNS services.

### 📱 **3. Client Application**

- Connect via a **web browser** or a **Python client**.
- Fetch encrypted data from the Raspberry Pi in station mode.
- Decrypt and visualize data through:
  - 📊 **Real-time Graphs**
  - 📡 **Live Data Streams**
  - 🚁 **3D Model**
  - 📈 **Historical Trends**

---

## 🔄 Data Flow

1. 📡 **MPU6050** collects motion(orientation & acceleration) and temperature data.
2. 🔄 Data is transmitted via **I2C** to the **Raspberry Pi**.
3. 🔐 **Rabbit Cipher encrypts** the data for secure transmission.
4. 🌍 Data is exposed through a **Flask API (`/gyro`)**.
5. 📡 Clients connect to the **RaspberryPi_Gyro WiFi network**.
6. 🔓 Clients request, decrypt, and visualize data in **real-time**!

---

## 📡 Network Configuration

| Component          | IP Configuration              |
| ------------------ | ----------------------------- |
| **Raspberry Pi**   | `192.168.4.1` (Static IP)     |
| **Client Devices** | `192.168.4.x` (DHCP Assigned) |
| **WiFi Network**   | `RaspberryPi_Gyro`            |

---

## 🚀 Getting Started

### 🔧 **Hardware Setup**

- Connect the **MPU6050** to the **Raspberry Pi** via **I2C**.
- Power on the **Raspberry Pi**.

### 🏗️ **Server Setup**

- The Raspberry Pi **automatically** starts the WiFi access point.
- The **Flask API** launches on startup.
- The Flask API connects dynamically with a **rabbitCli.exe** in real time that interacts with **Rabbit.h** (header file implementation) for Data Encryption
- We manually initialize rabbitCli.exe with 64 bit **IV** (Initialization Vector) and 128 bit **Key**

### 📱 **Client Setup**

- Connect to the **RaspberryPi_Gyro** WiFi network.
- Open a web browser and visit **[http://192.168.4.1](http://192.168.4.1)**.
- Alternatively, run the **Python client application**.

---

## 🔒 Security - Rabbit Cipher Encryption

This system ensures **secure data transmission** using the **Rabbit Cipher**, a high-speed encryption algorithm that keeps your motion data protected while enabling **real-time visualization**. 🛡⚡

---

## 📊 Visualization Options

🎯 **Dashboard UI** – Monitor sensor values live.
📡 **Raw Data Stream** – View unprocessed data.
📈 **Real-Time Graphs** – Instant data analysis.
🚀 **3D Model Representation** – Track orientation dynamically.
📉 **Historical Trends** – Discover motion patterns over time.

---

## 🛠 Technologies Used

- **Hardware**: Raspberry Pi + MPU6050 (Gyroscope & Accelerometer)
- **Programming**: Python, Flask, Matplotlib
- **Security**: Rabbit Cipher Encryption
- **Networking**: WiFi Access Point, I2C Protocol
- **Visualization**: 3D Model using React, PHP, HTML, CSS, JS

---

## 🌟 Why Choose This System?

✅ **Real-time data monitoring** with secure encryption.
✅ **Standalone operation** with its own WiFi network.
✅ **Interactive visualizations** for immersive insights.
✅ **Lightweight & efficient** for embedded applications.

🚀 _Unlock real-time motion tracking with security & performance – Welcome to the future of gyroscope monitoring!_ 🎯
