/*
 * Copyright (c) 2020 Lee Stemkoski 
 * SPDX-License-Identifier: MIT
 * Joystick movement detection based on code from https://github.com/stemkoski/HTML-Joysticks
 *
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { float } from 'aws-sdk/clients/lightsail';
import { Subscription, fromEvent } from 'rxjs';
import { MqttService } from '../mqtt.service';

@Component({
  selector: 'app-joymove',
  templateUrl: './joymove.component.html',
  styleUrls: ['./joymove.component.css']
})

export class JoymoveComponent implements OnInit, OnChanges {

  id;
  dragStart;
  active;
  value;
  touchId;
  stick;
  maxMove;
  minMove;
  mqttPayload;
  mqttTopic:string;
  joystickThreshold:float;

  @Input() thingName:string;

  constructor(private mqttService: MqttService) { }

  ngOnChanges(changes: SimpleChanges)
  {
    this.thingName = changes['thingName']['currentValue'];
    this.mqttTopic = "$aws/things/"+this.thingName+"/shadow/update";
  }

  ngOnInit(): void 
  {
    this.stick = document.getElementById('joyMove');
    this.maxMove = 64;
    this.minMove = 8;
    fromEvent(this.stick,'mousedown').subscribe((evt) => this.select(evt));
    fromEvent(this.stick,'touchstart').subscribe((evt) => this.select(evt));
    fromEvent(document,'mousemove').subscribe((evt) => this.move(evt));
    fromEvent(document,'touchmove').subscribe((evt) => this.move(evt));
    fromEvent(document,'mouseup').subscribe((evt) => this.release(evt));
    fromEvent(document,'touchend').subscribe((evt) => this.release(evt));

    this.dragStart = null;
    this.touchId = null;
    this.joystickThreshold = 0.2;
    this.active = false;
    this.value = { x: 0, y: 0 }; 
    this.mqttPayload = {
      'move_x' : "S",
      'move_y' : "S"
    }
  }

  select(event)
  {
    this.active = true;
    this.stick.style.transition = '0s';
    event.preventDefault();

    if (event.changedTouches)
    {
      this.dragStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    }
    else
    {
      this.dragStart = { x: event.clientX, y: event.clientY };
    }

    if (event.changedTouches)
    {
      this.touchId = event.changedTouches[0].identifier;
    }
  }
    
  move(event) 
  {
    if ( !this.active ) return;
    let touchmoveId = null;

    if (event.changedTouches)
    {
      for (let i = 0; i < event.changedTouches.length; i++)
      {
        if (this.touchId == event.changedTouches[i].identifier)
        {
          touchmoveId = i;
          event.clientX = event.changedTouches[i].clientX;
          event.clientY = event.changedTouches[i].clientY;
        }
      }

      if (touchmoveId == null) return;
    }

    const xDiff = event.clientX - this.dragStart.x;
    const yDiff = event.clientY - this.dragStart.y;
    const angle = Math.atan2(yDiff, xDiff);
    const distance = Math.min(this.maxMove, Math.hypot(xDiff, yDiff));
    const xPosition = distance * Math.cos(angle);
    const yPosition = distance * Math.sin(angle);

    this.stick.style.transform = `translate3d(${xPosition}px, ${yPosition}px, 0px)`;
    const distance2 = (distance < this.minMove) ? 0 : this.maxMove / (this.maxMove - this.minMove) * (distance - this.minMove);
    const xPosition2 = distance2 * Math.cos(angle);
    const yPosition2 = distance2 * Math.sin(angle);
    const xPercent = parseFloat((xPosition2 / this.maxMove).toFixed(4));
    const yPercent = parseFloat((yPosition2 / this.maxMove).toFixed(4));
      
    this.value = { x: xPercent, y: yPercent };
    this.processMoveRobot();
  }

  release(event) 
  {
    if ( !this.active ) return;
    if (event.changedTouches && this.touchId != event.changedTouches[0].identifier) return;

    this.stick.style.transition = '.2s';
    this.stick.style.transform = `translate3d(0px, 0px, 0px)`;

    this.value = { x: 0, y: 0 };
    this.touchId = null;
    this.active = false;
    this.mqttPayload = { "move_x": "S", "move_y": "S" };
    this.sendMqttMessage();
  }

  processMoveRobot()
  {
    //console.log("Moving joystick: ",this.value);
    let mv_x = "S";
    let mv_y = "S";

    if (this.value.x > this.joystickThreshold) 
    {
      //console.log("right");
      mv_y = "R";
    } 
    else if (this.value.x < -(this.joystickThreshold)) 
    {
      //console.log("left");
      mv_y = "L";
    }

    if (this.value.y > this.joystickThreshold) 
    {
      //console.log("backwards");
      mv_x = "B";
    }
    else if (this.value.y < -(this.joystickThreshold))
    {
      //console.log("forwards");
      mv_x = "F";
    }

    if (mv_x != this.mqttPayload.move_x || mv_y != this.mqttPayload.move_y) {
      this.mqttPayload.move_x = mv_x;
      this.mqttPayload.move_y = mv_y;
      this.sendMqttMessage()
    }
  }

  sendMqttMessage()
  {
    let full_msg = { "state": { "desired": { "direction": this.mqttPayload } } };    
    //console.log("Full payload:",full_msg)
    this.mqttService.sendMessage(this.mqttTopic,JSON.stringify(full_msg));
  }

}
