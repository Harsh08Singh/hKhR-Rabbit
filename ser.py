#!/usr/bin/python3
import smbus2
import time
import json
import os
import subprocess
import binascii
import tempfile
from flask import Flask, jsonify, request
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# MPU6050 I2C Address
MPU6050_ADDR = 0x68

# Register addresses
PWR_MGMT_1 = 0x6B
ACCEL_XOUT_H = 0x3B
GYRO_XOUT_H = 0x43
TEMP_OUT_H = 0x41

# Rabbit cipher file paths
RABBIT_CLI_PATH = "./rabbit_cli"
KEY_FILE_PATH = "/tmp/rabbit_key.bin"
IV_FILE_PATH = "/tmp/rabbit_iv.bin"

# Initialize I2C bus
bus = smbus2.SMBus(1)

# Default encryption key and IV
DEFAULT_KEY = b'\x01\x23\x45\x67\x89\xAB\xCD\xEF\xFE\xDC\xBA\x98\x76\x54\x32\x10'  # 16 bytes
DEFAULT_IV = b'\x12\x34\x56\x78\x90\xAB\xCD\xEF'  # 8 bytes

# Initialize encryption - write default key and IV to files
def init_encryption():
    try:
        with open(KEY_FILE_PATH, 'wb') as f:
            f.write(DEFAULT_KEY)
        with open(IV_FILE_PATH, 'wb') as f:
            f.write(DEFAULT_IV)
        print("Encryption initialized with default key and IV")
        return True
    except Exception as e:
        print(f"Error initializing encryption: {e}")
        return False

# Wake up MPU6050
try:
    bus.write_byte_data(MPU6050_ADDR, PWR_MGMT_1, 0)
    print("MPU6050 initialized successfully")
except Exception as e:
    print(f"Error initializing MPU6050: {e}")

def read_word(adr):
    """ Read two bytes from I2C device """
    try:
        high = bus.read_byte_data(MPU6050_ADDR, adr)
        low = bus.read_byte_data(MPU6050_ADDR, adr + 1)
        val = (high << 8) + low
        if val >= 0x8000:  # Convert to signed value
            val = -((65535 - val) + 1)
        return val
    except Exception as e:
        print(f"Error reading from MPU6050: {e}")
        return 0

def get_accel_data():
    """ Get accelerometer readings """
    try:
        accel_x = read_word(ACCEL_XOUT_H) / 16384.0  # Scale factor for ±2g range
        accel_y = read_word(ACCEL_XOUT_H + 2) / 16384.0
        accel_z = read_word(ACCEL_XOUT_H + 4) / 16384.0
        return {"accel_x": accel_x, "accel_y": accel_y, "accel_z": accel_z}
    except Exception as e:
        print(f"Error getting accelerometer data: {e}")
        return {"accel_x": 0, "accel_y": 0, "accel_z": 0}

def get_gyro_data():
    """ Get gyroscope readings """
    try:
        gyro_x = read_word(GYRO_XOUT_H) / 131.0  # Scale factor for ±250°/s range
        gyro_y = read_word(GYRO_XOUT_H + 2) / 131.0
        gyro_z = read_word(GYRO_XOUT_H + 4) / 131.0
        return {"gyro_x": gyro_x, "gyro_y": gyro_y, "gyro_z": gyro_z}
    except Exception as e:
        print(f"Error getting gyro data: {e}")
        return {"gyro_x": 0, "gyro_y": 0, "gyro_z": 0}

def get_temperature():
    """ Get temperature reading """
    try:
        temp_raw = read_word(TEMP_OUT_H)
        # Convert to Celsius according to MPU6050 datasheet formula
        temp_celsius = (temp_raw / 340.0) + 36.53
        return {"temp": temp_celsius}
    except Exception as e:
        print(f"Error getting temperature data: {e}")
        return {"temp": 0}

def get_sensor_data():
    """ Get all sensor data in a structured format """
    accel = get_accel_data()
    gyro = get_gyro_data()
    temp = get_temperature()
    
    timestamp = int(time.time() * 1000)  # Current time in milliseconds
    
    return {
        "timestamp": timestamp,
        "accel": {
            "x": round(accel["accel_x"], 3),
            "y": round(accel["accel_y"], 3),
            "z": round(accel["accel_z"], 3)
        },
        "gyro": {
            "x": round(gyro["gyro_x"], 3),
            "y": round(gyro["gyro_y"], 3),
            "z": round(gyro["gyro_z"], 3)
        },
        "temp": round(temp["temp"], 1)
    }

def encrypt_data(data_bytes):
    """Encrypt data using the Rabbit cipher"""
    # Create temp files for input and output
    with tempfile.NamedTemporaryFile(delete=False) as input_file:
        input_path = input_file.name
        input_file.write(data_bytes)
    
    output_path = input_path + ".enc"
    
    try:
        # Call the rabbit_cli to encrypt the data
        cmd = [RABBIT_CLI_PATH, "encrypt", KEY_FILE_PATH, IV_FILE_PATH, input_path, output_path]
        result = subprocess.run(cmd, capture_output=True, check=True)
        
        # Read the encrypted data
        with open(output_path, 'rb') as f:
            encrypted_data = f.read()
            
        # Clean up temp files
        os.unlink(input_path)
        os.unlink(output_path)
        
        return encrypted_data
    except subprocess.CalledProcessError as e:
        print(f"Encryption error: {e.stderr.decode()}")
        # Clean up temp files
        if os.path.exists(input_path):
            os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)
        return None

@app.route('/')
def index():
    """ Root endpoint """
    return "MPU6050 Sensor Data API with Rabbit Encryption - Use /api/sensor-data endpoint to get data"

@app.route('/api/sensor-data', methods=['GET'])
def send_sensor_data():
    """ API Endpoint to return encrypted sensor data """
    # Get the sensor data
    data = get_sensor_data()
    
    # Convert to JSON bytes
    json_data = json.dumps(data).encode('utf-8')
    
    # Encrypt the data
    encrypted_data = encrypt_data(json_data)
    
    if encrypted_data is None:
        return jsonify({"error": "Encryption failed"}), 500
    
    # Convert binary data to hex string for transmission in JSON
    encrypted_hex = binascii.hexlify(encrypted_data).decode('utf-8')
    
    # Return encrypted data with metadata
    response = {
        "encrypted_data": encrypted_hex,
        "encoding": "hex",
        "encryption": "rabbit",
        "data_length": len(json_data)
    }
    
    print(f"Sensor data encrypted: Original size={len(json_data)}, Encrypted size={len(encrypted_data)}")
    return jsonify(response)

@app.route('/api/set-encryption-key', methods=['POST'])
def set_encryption_key():
    """Set a new encryption key and IV"""
    try:
        data = request.get_json()
        
        if 'key' in data:
            key_hex = data['key']
            key_bytes = binascii.unhexlify(key_hex)
            if len(key_bytes) != 16:
                return jsonify({"error": "Key must be 16 bytes (32 hex characters)"}), 400
            
            with open(KEY_FILE_PATH, 'wb') as f:
                f.write(key_bytes)
        
        if 'iv' in data:
            iv_hex = data['iv']
            iv_bytes = binascii.unhexlify(iv_hex)
            if len(iv_bytes) != 8:
                return jsonify({"error": "IV must be 8 bytes (16 hex characters)"}), 400
            
            with open(IV_FILE_PATH, 'wb') as f:
                f.write(iv_bytes)
        
        return jsonify({"success": True, "message": "Encryption parameters updated"})
    
    except Exception as e:
        return jsonify({"error": f"Failed to update encryption parameters: {str(e)}"}), 500

# Keep the original endpoint for backward compatibility
@app.route('/gyro', methods=['GET'])
def send_gyro_data():
    """ Legacy API Endpoint to return gyroscope data only """
    gyro = get_gyro_data()
    data = {
        "gyro_x": gyro["gyro_x"],
        "gyro_y": gyro["gyro_y"],
        "gyro_z": gyro["gyro_z"]
    }
    print(f"Gyro data: X={data['gyro_x']:.2f}, Y={data['gyro_y']:.2f}, Z={data['gyro_z']:.2f}")
    return jsonify(data)

if __name__ == '__main__':
    # Initialize encryption
    init_encryption()
    
    print("Starting MPU6050 Sensor Flask Server with Rabbit Encryption...")
    print("Listening on 0.0.0.0:5000")
    # Run Flask app on all interfaces
    app.run(host="0.0.0.0", port=5000, debug=False)