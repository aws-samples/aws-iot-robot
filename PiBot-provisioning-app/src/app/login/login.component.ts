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

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  username;
  password;
  loginStatus:string = "";
  loginFailed:boolean = false;

  constructor(public auth: AuthService, private router: Router ) { }

  ngOnInit(): void {
  }

  login()
  {
    console.log("Signing in:");
    this.auth.authUser(this.username,this.password)
      .then(
        data => 
        {
          console.log("Successfully logged in");
          this.router.navigate(['/provision']);
        },
        error => 
        {
          console.error("Login failed");
          this.loginFailed = true;
          this.loginStatus = "Login failed - incorrect username or password";
        }
      );
  }

  resetPassword(oldPw,newPw)
  {
    this.auth.resetPassword(oldPw,newPw);
  }

  returnToLogin()
  {
    this.auth.returnToLoginPage();
  }

}
