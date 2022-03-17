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

import { Injectable } from '@angular/core';
import * as awsConfig from './awsconfig';
import * as AWS from 'aws-sdk';
import * as CryptoJS from 'crypto-js';
import * as AmazonCognitoIdentity from 'amazon-cognito-identity-js';
import { Subject, Observable } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  self = this;
  private _cognitoUser;
  private _idToken = new Subject<any>();
  private _credentials = new Subject<any>();
  userAttribs;
  authData;
  resetRequired:boolean = false;
  returnToLogin:boolean = false;

  //idToken$ = this._idToken.asObservable();
  //credentials$ = this._credentials.asObservable();

  constructor(private router: Router) 
  { 
    AWS.config.region = awsConfig.region;
  }
  
  isAuthenticated(): boolean {
    console.log("Checking if user is authenticated");
    if (!AWS.config.credentials)
    {
      console.log("Not authenticated - no credentials set");
      return false;
    }
    else
    {
      if (AWS.config.credentials['expired'])
      {
        console.log("Not authenticated - credentials expired");
        return false;
      }
      else
      {
        console.log("Authenticated");
        return true;
      }
    }
  }

  async authUser(username:string,password:string)
  {
    console.log("Signing in with:",username,password);
    let self = this;
    let authInfo = {
      Username: username,
      Password: password
    };
    this.authData = new AmazonCognitoIdentity.AuthenticationDetails (
      authInfo
    );

    let poolData = {
      UserPoolId: awsConfig.cognitoUserPool,
      ClientId: awsConfig.cognitoClientId,
      TokenScopesArray: ['email', 'openid']
    };
    let userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    let userData = {
      Username: username,
      Pool: userPool
    }
    this._cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    
    const promise = new Promise((resolve,reject) => { 
      var self=this;
      this._cognitoUser.authenticateUser(this.authData, {
        onSuccess: function(result) 
        {
          console.log("Successfully authenticated using Cognito");
          //let accessToken = result.getAccessToken().getJwtToken();
          let idToken = result.getIdToken().getJwtToken();
          self._idToken.next(idToken);
          let cogUri:string = 'cognito-idp.'+awsConfig.region+'.amazonaws.com/'+awsConfig.cognitoUserPool;

          AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: awsConfig.cognitoIdPoolId,
            Logins: {
              [cogUri]: idToken
            }
          });
          AWS.config.credentials['refresh'](error => {
            if (error)
            {
              console.log("Cred refresh error:",error);
            }
            else
            {
              console.log("Refresh successful");
              console.log("AWS Creds from AUTH Service:",AWS.config.credentials);
              //self.attachPrincipalPolicy(awsConfig.cognitoIoTPolicy,AWS.config.credentials['identityId']);
              resolve(self._credentials);
            }
          });
        },
        onFailure: function (error)
        {
          console.log("Failed to auth using Cognito",error);
          reject();
        },
        newPasswordRequired: function(userAttributes,requiredAttributes) 
        {
          console.log("Need to reset password");
          self.userAttribs = userAttributes;
          self.resetRequired = true;
        }
      });
    });
    return promise;
  }

  resetPassword(oldPw,newPw)
  {
    var self = this;
    console.log("Setting new password for:",this._cognitoUser);
    console.log("User attribs:",this.userAttribs);
    console.log("Auth Data:",self.authData);

    delete this.userAttribs.email;
    delete this.userAttribs.email_verified;
    delete this.userAttribs.phone_number_verified;
    this.userAttribs.name = "temp_name";

    this._cognitoUser.completeNewPasswordChallenge(newPw,this.userAttribs, {
      onSuccess: function(result)
      {
        console.log("Set new password");
        self.returnToLogin = true;
      },
      onFailure: function(err)
      {
        console.log("Failed to set new password: ",err);
      }
    });

  }

  attachPrincipalPolicy(policyName,principal)
  {
    console.log("Attaching IoT policy to principal:",policyName,principal);
    new AWS.Iot().attachPrincipalPolicy({ policyName: policyName, principal: principal }, function (err, data) {
      if (err) 
      {
        console.error(err); // an error occurred
      }
    });
  }

  getPolicyPrincipals(policyName)
  {
    let params = { policyName: policyName };
    let pols = new AWS.Iot().listTargetsForPolicy(params, function (err,data) {
      if (err) console.log(err,err.stack);
      else console.log(data);
    });
    return pols;
  }

  getCredentials()
  {
    return AWS.config.credentials;
  }

  signOut()
  {
    console.log("Signing out");
    this._cognitoUser.signOut();
    this.router.navigate(['/login']);
  }

  returnToLoginPage()
  {
    this.resetRequired = false;
  }

}
