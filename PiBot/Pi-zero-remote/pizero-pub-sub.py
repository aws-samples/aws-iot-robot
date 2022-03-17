# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0.
# Modifications Copyright 2022 Amazon.com, Inc. or its affiliates. Licensed under the MIT-0 License.

import argparse
from awscrt import io, mqtt, auth, http
from awsiot import mqtt_connection_builder
import sys
import threading
import time
from uuid import uuid4
import json
import time

## AWS IoT Robot modifications
import board
import busio
import adafruit_adxl34x
import RPi.GPIO as GPIO

# for the accelerometer module
i2c = busio.I2C(board.SCL, board.SDA)
accelerometer = adafruit_adxl34x.ADXL345(i2c)

# for the push button
move_button_gpio = 7
camera_button_gpio = 21
GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup(move_button_gpio, GPIO.IN, pull_up_down=GPIO.PUD_UP) # Move button - initialises with down/off
GPIO.setup(camera_button_gpio, GPIO.IN, pull_up_down=GPIO.PUD_UP) # Camera button

# For capturing current vals so only publish message on change
current_vals = {}
received_count = 0
received_all_event = threading.Event()
payload = { "move_x": "S", "move_y": "S", "cam_x": "S", "cam_y": "S" }
## END AWS IoT Robot modifications

parser = argparse.ArgumentParser(description="Send and receive messages through and MQTT connection.")
parser.add_argument('--endpoint', required=True, help="Your AWS IoT custom endpoint, not including a port. " +
                                                      "Ex: \"abcd123456wxyz-ats.iot.us-east-1.amazonaws.com\"")
parser.add_argument('--port', type=int, help="Specify port. AWS IoT supports 443 and 8883.")
parser.add_argument('--cert', help="File path to your client certificate, in PEM format.")
parser.add_argument('--key', help="File path to your private key, in PEM format.")
parser.add_argument('--root-ca', help="File path to root certificate authority, in PEM format. " +
                                      "Necessary if MQTT server uses a certificate that's not already in " +
                                      "your trust store.")
parser.add_argument('--client-id', default="pi-remote", help="Client ID for MQTT connection.")
parser.add_argument('--topic', default="$aws/things/pb_pibot/shadow/update", help="Topic to subscribe to, and publish messages to.")
parser.add_argument('--verbosity', choices=[x.name for x in io.LogLevel], default=io.LogLevel.NoLogs.name,
    help='Logging level')

# Using globals to simplify sample code
args = parser.parse_args()

io.init_logging(getattr(io.LogLevel, args.verbosity), 'stderr')

# Callback when connection is accidentally lost.
def on_connection_interrupted(connection, error, **kwargs):
    print("Connection interrupted. error: {}".format(error))

# Callback when an interrupted connection is re-established.
def on_connection_resumed(connection, return_code, session_present, **kwargs):
    print("Connection resumed. return_code: {} session_present: {}".format(return_code, session_present))

    if return_code == mqtt.ConnectReturnCode.ACCEPTED and not session_present:
        print("Session did not persist. Resubscribing to existing topics...")
        resubscribe_future, _ = connection.resubscribe_existing_topics()

        # Cannot synchronously wait for resubscribe result because we're on the connection's event-loop thread,
        # evaluate result with a callback instead.
        resubscribe_future.add_done_callback(on_resubscribe_complete)

def on_resubscribe_complete(resubscribe_future):
        resubscribe_results = resubscribe_future.result()
        print("Resubscribe results: {}".format(resubscribe_results))

        for topic, qos in resubscribe_results['topics']:
            if qos is None:
                sys.exit("Server rejected resubscribe to topic: {}".format(topic))

# Callback when the subscribed topic receives a message
def on_message_received(topic, payload, dup, qos, retain, **kwargs):
    print("Received message from topic '{}': {}".format(topic, payload))

## AWS IoT Robot modifications
# Get accelerometer and button values
def get_accelerometer():
    while True:
        #print("%f %f %f"%accelerometer.acceleration)
        time.sleep(0.25)
        acc = accelerometer.acceleration
        changed = False

        # X Axis - set forward or backward
        if int(acc[0]) >= 2:
            x = "F"
        elif int(acc[0]) <= -2:
            x = "B"
        else:
            x = "S"

        # Y Axis - set left or right
        if int(acc[1]) >= 2:
            y = "L"
        elif int(acc[1]) <= -2:
            y = "R"
        else:
            y = "S"

        # if button not pressed then stop if not already done sone
        if GPIO.input(move_button_gpio) == GPIO.HIGH:
            if payload["move_x"] != "S" or payload["move_y"] != "S":
                # stop movement as button not pressed
                changed = True
                payload["move_x"] = "S"
                payload["move_y"] = "S"
        else:
            if x != payload["move_x"] or y != payload["move_y"]:
                # Move button pressed so update movement
                changed = True
                payload["move_x"] = x
                payload["move_y"] = y


        if GPIO.input(camera_button_gpio) == GPIO.HIGH:
            if payload["cam_x"] != "S" or payload["cam_y"] != "S":
                # stop movement as button not pressed
                changed = True
                payload["cam_x"] = "S"
                payload["cam_y"] = "S"
        else:
            if x != payload["cam_x"] or y != payload["cam_y"]:
                # Move button pressed so update movement
                changed = True
                payload["cam_x"] = x
                payload["cam_y"] = y

        # Publish to PiBot shadow topic, but only if changed
        if changed:
            publish_message(payload)

def publish_message(message):
    full_msg = { "state": { "desired": { "direction": message } } }
    message_json = json.dumps(full_msg)
    #print("Publishing: ",full_msg)
    mqtt_connection.publish(
        topic=args.topic,
        payload=message_json,
        qos=mqtt.QoS.AT_LEAST_ONCE)
## END AWS IoT Robot modifications

if __name__ == '__main__':
    # Spin up resources
    event_loop_group = io.EventLoopGroup(1)
    host_resolver = io.DefaultHostResolver(event_loop_group)
    client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)

    proxy_options = None

    mqtt_connection = mqtt_connection_builder.mtls_from_path(
        endpoint=args.endpoint,
        port=args.port,
        cert_filepath=args.cert,
        pri_key_filepath=args.key,
        client_bootstrap=client_bootstrap,
        ca_filepath=args.root_ca,
        on_connection_interrupted=on_connection_interrupted,
        on_connection_resumed=on_connection_resumed,
        client_id=args.client_id,
        clean_session=False,
        keep_alive_secs=30,
        http_proxy_options=proxy_options)

    print("Connecting to {} with client ID '{}'...".format(
        args.endpoint, args.client_id))

    connect_future = mqtt_connection.connect()

    # Future.result() waits until a result is available
    connect_future.result()
    print("Connected!")

    # Subscribe
    print("Subscribing to topic '{}'...".format(args.topic))
    subscribe_future, packet_id = mqtt_connection.subscribe(
        topic=args.topic,
        qos=mqtt.QoS.AT_LEAST_ONCE,
        callback=on_message_received)

    subscribe_result = subscribe_future.result()
    print("Subscribed with {}".format(str(subscribe_result['qos'])))

    get_accelerometer()