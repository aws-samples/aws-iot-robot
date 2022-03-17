/*
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

import { AfterViewInit, Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent extends DashboardComponent implements OnInit,AfterViewInit {

  @ViewChild('mapcanvas', {static: false}) 
  mapCanvas: ElementRef<HTMLCanvasElement>;
  public ctx: CanvasRenderingContext2D;
  curPosX = 300; //start position
  curPosY = 250; // start position
  robotDegrees = 0; //degrees
  degreesStep = 5; // number of degrees to change on move left or right
  pixelsToMove = 5; // how many pixels to move on map
  turningPixels = 2;
  moveIntervals;
  proximity;

  mqttClient;
  mqttMessages:Subscription;
  mqttCommands = [];
  awsCredentials;

  ngOnInit()
  {

  }

  ngAfterViewInit(): void 
  {
    this.ctx = this.mapCanvas.nativeElement.getContext('2d');
    this.ctx.beginPath();
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = "#FF0000";
    this.awsCredentials = this.authService.getCredentials();
    this.moveIntervals = [];
    this.mqttMessages = this.mqttService.mqttMessages$
      .subscribe(mqttMessages => this.processMqttMessage(mqttMessages));
  }

  connect(awsCredentials)
  {
    this.mqttService.connect(awsCredentials['accessKeyId'],awsCredentials['secretAccessKey'],awsCredentials['sessionToken']);
  }

  calcMovement(pixels)
  {
    // calculate new X and Y for line move to
    // first get delta and then add to existing (ydelta = hypotenuse * sin(angle), xdelta = hypotenuse * cos(angle))
    // convert degrees to radians for sin/cos commands
    const PI = Math.PI;
    let xDelta = pixels * Math.sin((PI/180)*this.robotDegrees);
    //console.log("xDelta:",xDelta);
    let yDelta = pixels * Math.cos((PI/180)*this.robotDegrees);
    //console.log("yDelta:",yDelta);
    //console.log("New X and Y:",this.curPosX+xDelta,this.curPosY+yDelta);
    return [this.curPosX+xDelta,this.curPosY+yDelta];
  }

  moveRobotOnMap(dir)
  {
    let newPos = this.calcMovement(dir);
    console.log("Moving robot on map:",newPos);
    // Draw new line and update reference position
    this.ctx.moveTo(this.curPosX,this.curPosY);
    this.ctx.lineTo(newPos[0],newPos[1]);
    this.ctx.stroke();
    this.curPosX = newPos[0];
    this.curPosY = newPos[1];
  }

  setRobotDirection(dir)
  {
    console.log("Setting robot orientation");
    if (dir == 'R')
    {
      // -ve degree movement
      this.robotDegrees > this.degreesStep ? this.robotDegrees -= this.degreesStep : this.robotDegrees = 359;
    }
    else if (dir == 'L')
    {
      // +ve degree movement
      this.robotDegrees < (359 - this.degreesStep) ? this.robotDegrees += this.degreesStep : this.robotDegrees = 0;
    }
  }

  processMqttMessage(message)
  {
    try
    {
      if ('direction' in message)
      {
        if (message['direction']['move_x'] != "S" || message['direction']['move_y'] != "S")
        {
          if (message['direction']['move_y'] == 'L' || message['direction']['move_y'] == 'R')
          {
            let newInt = setInterval(this.setRobotDirection.bind(this),2000,(message['direction']['move_y']));
            this.moveIntervals.push(newInt);
          }
          
          if (message['direction']['move_x'] != "S")
          {
            var dir;
            message['direction']['move_x'] == "F" ? dir = this.pixelsToMove : dir = -(this.pixelsToMove);
            let newInt = setInterval(this.moveRobotOnMap.bind(this),2000,dir)
            this.moveIntervals.push(newInt);
          }
        }
        else
        {
          //clear all intervals
          console.log("Clearing all intervals");
          for (var id of this.moveIntervals)
          {
            clearInterval(id);
          }
        }
      } 
      else if ('distance' in message)
      {
        this.proximity = message['distance'];
      }
    }
    catch
    {
      console.log("process mqtt error")
    }
  }

  calibrate(event)
  {

  }

}
