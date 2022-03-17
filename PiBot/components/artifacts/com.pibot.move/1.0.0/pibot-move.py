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

import time
import sys
import threading
import traceback
import json
import RPi.GPIO as gpio

import awsiot.greengrasscoreipc
import awsiot.greengrasscoreipc.client as client
from awsiot.greengrasscoreipc.model import (
    SubscribeToIoTCoreRequest,
    PublishToIoTCoreRequest,
    QOS,
    IoTCoreMessage
)
#from awsiot.greengrasscoreipc.model import GetThingShadowRequest
#from awsiot.greengrasscoreipc.model import UpdateThingShadowRequest

ipc_client = awsiot.greengrasscoreipc.connect()
camera_pin_x = int(sys.argv[1])
camera_pin_y = int(sys.argv[2])
lcoil_pins = list(map(int,sys.argv[3].split(",")))
rcoil_pins = list(map(int,sys.argv[4].split(",")))
TIMEOUT = 10
client_id = sys.argv[5]
thing_name = sys.argv[5]

subscribe_topic = "$aws/things/"+thing_name+"/shadow/update/accepted"
publish_topic = "$aws/things/"+thing_name+"/shadow/update"
sub_qos = QOS.AT_MOST_ONCE
pub_qos = QOS.AT_LEAST_ONCE
shadow_value = { "move_x": "S", "move_y": "S", "cam_x": "S", "cam_y": "S" }
camera_angle_x = 90
camera_angle_y = 90

gpio.setmode(gpio.BCM)
gpio.setwarnings(False)

step_count = 8
seq_f = list(range(0,step_count))
seq_f = [[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,1,1],[0,0,0,1],[1,0,0,1]]

seq_r = list(range(0,step_count))
seq_r = [[1,0,0,1],[0,0,0,1],[0,0,1,1],[0,0,1,0],[0,1,1,0],[0,1,0,0],[1,1,0,0],[1,0,0,0]]

for lpin,rpin in zip(lcoil_pins,rcoil_pins):
    gpio.setup(lpin,gpio.OUT)
    gpio.setup(rpin,gpio.OUT)

gpio.setup(camera_pin_x,gpio.OUT)
gpio.setup(camera_pin_y,gpio.OUT)

class MotorThread(threading.Thread):
    def __init__(self,motor_name,pins,delay=0.01,direction="S"):
        threading.Thread.__init__(self)

        self.thread_id = motor_name
        self.direction = direction
        self.delay = delay
        self.pins = pins

        self.terminate_event = threading.Event()
        self.start_event = threading.Event()
        self.reset_event = threading.Event()

    def run(self):
        while not self.terminate_event.is_set():
            while self.start_event.is_set():
                if self.direction == "f":
                    self.do_steps(seq_f)
                elif self.direction == "b":
                    self.do_steps(seq_r)

    def set_direction(self,direction):
        self.direction = direction

    def set_delay(self,delay):
        self.delay = delay

    def start_motor(self):
        self.start_event.set()

    def stop_motor(self):
        self.start_event.clear()

    def set_steps(self,num_steps):
        self.num_steps = num_steps

    def do_steps(self,arr):
        for steps in range(self.num_steps):
            for step in range(step_count):
                pin_idx = 0
                for pin in self.pins:
                    gpio.output(pin,arr[step][pin_idx])
                    pin_idx += 1
                time.sleep(self.delay)

    def restart_motor(self):
        # reset only if motor is running. otherwise start motor afresh
        if self.start_event.is_set():
            self.reset_event.set()
        else:
            self.start_event.set()

    def terminate(self):
        self.terminate_event.set()

class CameraThread(threading.Thread):
    def __init__(self,servo_name,servo_pin,angle=90,dir="f"):
        threading.Thread.__init__(self)

        print("Init servo:",servo_name,servo_pin)
        self.servo = gpio.PWM(servo_pin, 100)
        self.name = servo_name
        self.angle = angle
        self.dir = dir
        self.angle = 90
        self.set_angle(self.angle)

        self.start_event = threading.Event()
        self.terminate_event = threading.Event()

    def run(self):
        print("run")

    def start_servo(self):
        self.servo.start(5)

    def set_angle(self,angle):
        print("Setting angle:",self.name,angle)
        self.angle = angle
        duty = float(angle) / 10.0 + 2.5
        self.servo.ChangeDutyCycle(duty)

    def get_angle(self):
        return int(self.angle)

    def stop_servo(self):
        print("Stopping servo",self.name)
        self.servo.ChangeDutyCycle(0)

    def terminate(self):
        self.terminate_event.set()

class StreamHandler(client.SubscribeToIoTCoreStreamHandler):
    def __init__(self):
        super().__init__()

    def on_stream_event(self, event: IoTCoreMessage) -> None:
        try:
            message_string = str(event.message.payload, "utf-8")
            # Load message and check values
            jsonmsg = json.loads(message_string)

            if jsonmsg['state']['desired']['direction']:
                print("Move motor or camera: ",jsonmsg)
                if "move_x" in jsonmsg['state']['desired']['direction']:
                    set_motor_direction(jsonmsg['state']['desired']['direction'])
                if "cam_x" in jsonmsg['state']['desired']['direction']:
                    set_camera_angle(jsonmsg['state']['desired']['direction'])
                #pub_thread.publish(jsonmsg)
        except:
            traceback.print_exc()

    def on_stream_error(self, error: Exception) -> bool:
        # Handle error.
        return True  # Return True to close stream, False to keep stream open.

    def on_stream_closed(self) -> None:
        # Handle close.
        pass

class update_thing_shadow_request(threading.Thread):
    def __init__(self,name="pub"):
        threading.Thread.__init__(self)
        self.name = name

    def run(self):
        print("run")

    def set_topic(self,topic):
        self.topic = topic

    def publish(self,payload):
        try:
            payload['state']['reported'] = payload['state']['desired']
            pub_req = PublishToIoTCoreRequest()
            pub_req.topic_name = self.topic
            pub_req.payload = json.dumps(payload).encode('utf-8')
            pub_req.qos = pub_qos
            send_msg = ipc_client.new_publish_to_iot_core()
            send_msg.activate(pub_req)
            msg_resp = send_msg.get_response()
            #msg_resp.result(TIMEOUT)
        except Exception as e:
            print("Error update shadow", type(e), e)
            # except ConflictError | UnauthorizedError | ServiceError

def set_motor_direction(direction):
    # set the direction for the motors based on shadow values
    # this function only called if the shadow value has changed
    motor_l_delay = 0.0008
    motor_r_delay = 0.0008

    if direction['move_x'] == "F":
        #print("Forward")
        motorL.set_direction("f")
        motorR.set_direction("b")
        if direction['move_y'] == "L":
            #print(" and to the left")
            motor_l_delay *= 2
        elif direction['move_y'] == "R":
            #print(" and to the right")
            motor_r_delay *= 2 
    elif direction['move_x'] == "B":
        #print("Backwards")
        motorL.set_direction("b")
        motorR.set_direction("f")
        if direction['move_y'] == "L":
            #print(" and to the left")
            motor_r_delay *= 2
        elif direction['move_y'] == "R":
            #print(" and to the right")
            motor_l_delay *= 2
    elif direction['move_x'] == "S":
        # pure left or right, so both motors in same dir at same speed
        if direction['move_y'] == "L":
            #print("Only Left")
            motorL.set_direction("b")
            motorR.set_direction("b")
        elif direction['move_y'] == "R":
            #print("Only Right")
            motorL.set_direction("f")
            motorR.set_direction("f")

    if direction['move_x'] != "S" or direction['move_y'] != "S":
        motorL.set_delay(motor_l_delay)
        motorR.set_delay(motor_r_delay)
        motorL.set_steps(100)
        motorR.set_steps(100)
        motorL.start_motor()
        motorR.start_motor()
    else:
        motorL.stop_motor()
        motorR.stop_motor()

def set_camera_angle(direction):
    #print("Set camera angle:",direction['cam_x'],direction['cam_y'])

    if (servoX.get_angle() != int(direction['cam_x'])):
        servoX.start_servo()
        servoX.set_angle(int(direction['cam_x']))
        time.sleep(0.5)
        servoX.stop_servo()

    if (servoY.get_angle() != int(direction['cam_y'])):
        servoY.start_servo()
        servoY.set_angle(int(direction['cam_y']))
        time.sleep(0.5)
        servoY.stop_servo()

print("Launching thread to manage motors...")
motorL = MotorThread("LeftMotor",lcoil_pins)
motorL.start()
motorR = MotorThread("RightMotor",rcoil_pins)
motorR.start()
print("motor init complete")

print("Launching Camera servo threads")
servoX = CameraThread("axis_x",camera_pin_x)
servoY = CameraThread("axis_y",camera_pin_y)

#subscribe to shadow update topic
print("Subscribing to MQTT topic for shadow")
request = SubscribeToIoTCoreRequest()
request.topic_name = subscribe_topic 
request.qos = sub_qos
handler = StreamHandler()
operation = ipc_client.new_subscribe_to_iot_core(handler) 
future = operation.activate(request)
future.result(TIMEOUT)
print("Finished subscription")

pub_thread = update_thing_shadow_request("pub_shadow")
pub_thread.set_topic(publish_topic)

# Keep main thread running
while True:
    time.sleep(10)
