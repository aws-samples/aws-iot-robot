#/*
# * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# *
# * SPDX-License-Identifier: MIT-0
# * Permission is hereby granted, free of charge, to any person obtaining a copy of this
# * software and associated documentation files (the "Software"), to deal in the Software
# * without restriction, including without limitation the rights to use, copy, modify,
# * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
# * permit persons to whom the Software is furnished to do so.
# *
# * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
# * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
# * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
# * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
# * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
# */

import json
import boto3
import RPi.GPIO as GPIO
import time
import math
import sys
import awsiot.greengrasscoreipc
import awsiot.greengrasscoreipc.client as client
from awsiot.greengrasscoreipc.model import (
        QOS,
        PublishToIoTCoreRequest
)

ipc_client = awsiot.greengrasscoreipc.connect()

echo_GPIO = int(sys.argv[1])
trigger_GPIO = int(sys.argv[2])
distance_threshold = float(sys.argv[3])
topic = "PiBot/proximity"
qos = QOS.AT_LEAST_ONCE
TIMEOUT = 10

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(echo_GPIO, GPIO.IN)
GPIO.setup(trigger_GPIO, GPIO.OUT)

def publish_to_mqtt(distance):
    payload = { "distance": distance }
    request = PublishToIoTCoreRequest()
    request.topic_name = topic
    request.payload = json.dumps(payload).encode('utf-8')
    request.qos = qos
    operation = ipc_client.new_publish_to_iot_core()
    operation.activate(request)
    future = operation.get_response()
    future.result(TIMEOUT)
    return

def get_proximity():
    while True:
        #print("Measuring distance")
        GPIO.output(trigger_GPIO,False)
        time.sleep(2)

        GPIO.output(trigger_GPIO, True)
        time.sleep(0.00001)
        GPIO.output(trigger_GPIO, False)

        while GPIO.input(echo_GPIO)==0:
            pulse_start = time.time()

        while GPIO.input(echo_GPIO)==1:
            pulse_end = time.time()

        pulse_duration = pulse_end - pulse_start
        distance = pulse_duration * 17150
        distance = round(distance, 2)
        print ("Distance:",distance,"cm")

        # only publish if within a certain distance to object
        if (distance <= distance_threshold):
            publish_to_mqtt(distance)

get_proximity()
