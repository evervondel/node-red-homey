const fetch = require("node-fetch");

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('unhandledRejection', error.message);
  });


// -------- o - Configure these parameters -------- o -------- o 
let email = 'erwin.vervondel@gmail.com'
let password = 'Homey1891'
let client_id = '5a8d4ca6eb9f7a2c9d6ccf6d'
let client_secret = 'e3ace394af9f615857ceaa61b053f966ddcfb12a'
let redirect_url = 'http://localhost'
let cloudid = '5ffd76cff8aa120b90b32787'

// -------- o -------- o -------- o -------- o -------- o 


const between = function(str, strf, strt) {
  return str.split(strf).pop().split(strt)[0].trim();
}

async function login() {

//  Step 1, get a JWT token with your credentials.  
const authurl = 'https://accounts.athom.com/login'
console.log("POST authentication " + authurl)
const response2 = await fetch(authurl, {
"headers": {
  "accept": "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
},
"referrerPolicy": "no-referrer-when-downgrade",
"body": 'email=' +encodeURIComponent(email) + '&password=' + encodeURIComponent(password) + '&otptoken=',
"method": "POST",
"mode": "cors",
"credentials": "omit"
})
const body2 = await response2.text()
const token = JSON.parse(body2)

// Step 2, obtain a delegation code.
const authorizeurl = 'https://accounts.athom.com/oauth2/authorise?client_id=' + client_id + 
  '&redirect_uri=' + encodeURIComponent(redirect_url) + '&response_type=code&user_token=' + token.token

console.log(" Response from accounts.athom.com/login ", body2)
console.log("GET Authorization " + authorizeurl)

const response3 = await fetch(authorizeurl, {
"headers": {
},
"method": "GET",
"mode": "cors",
"credentials": "include"
})
const body3 = await response3.text()
let csrf = between(body3, 'name="_csrf" value="', '">')

let raw = response3.headers.raw()['set-cookie']
let rawd = raw[0].split(';')
let cookiecsrf = null
rawd.forEach(el => {
  let dc = el.split('=')
  if (dc[0] === '_csrf') {
      cookiecsrf = dc[1]
  }
})

let cookie4 = '_csrf=' + cookiecsrf
// console.log("Cookie4", cookie4)
console.log(" CSRF input parameter", csrf)
console.log(" CSRF cookie", cookiecsrf)

let authorizeurl2 = 'https://accounts.athom.com/authorise?client_id=' + client_id +   '&redirect_uri=' + encodeURIComponent(redirect_url) + '&response_type=code&user_token=' + token.token
console.log("GET Authorization", authorizeurl2)
const response4 = await fetch(authorizeurl2, {
"headers": {
  "content-type": "application/x-www-form-urlencoded",
  "cookie": cookie4
},
"redirect": "manual",
"body": "resource=resource.homey." + cloudid + "&_csrf=" + csrf + "&allow=Allow",
"method": "POST",
"mode": "cors",
"credentials": "include"
});

const body4 = await response4.text()
//let code = response4.headers['_headers'].location[0].split('=')[1]
let code = body4.split("=")[1]

//console.log(" Response from authorization. Redirect to ", response4.headers['_headers'].location[0])
console.log(" Response content ", body4)
console.log(" Parsed the following code ", code)



let tokenendpoint = 'https://api.athom.com/oauth2/token'
console.log("POST token (resolve code to token) " + tokenendpoint)
const response5 = await fetch(tokenendpoint, {
"headers": {
  "content-type": "application/x-www-form-urlencoded",
},
"body": 'client_id=' + encodeURIComponent(client_id) +  '&client_secret=' + encodeURIComponent(client_secret) + 
  '&grant_type=authorization_code&code=' + encodeURIComponent(code),
"method": "POST",
"mode": "cors",
"credentials": "include"
});


//console.log("Response5", response5)
const body5 = await response5.text()
let accesstoken = JSON.parse(body5)
console.log("Access Token", accesstoken)


let delegationEndpoint = 'https://api.athom.com/delegation/token?audience=homey'
const response6 = await fetch(delegationEndpoint, {
"headers": {
  "content-type": "application/x-www-form-urlencoded",
  "authorization": "Bearer " + accesstoken.access_token
},
"referrerPolicy": "no-referrer-when-downgrade",
"body": "client_id=" + client_id + " &client_secret=" + client_secret + "&grant_type=refresh_token&refresh_token=" + accesstoken.refresh_token,
"method": "POST",
"mode": "cors",
"credentials": "include"
});



const body6 = await response6.json()
console.log(" JWT token is " + body6)

let endpoint7 = 'https://' + cloudid + '.connect.athom.com/api/manager/users/login'
console.log("POST login endpoint " + endpoint7)
const response7 = await fetch(endpoint7, {
"headers": {
  "content-type": "application/json",
  //"authorization": "Bearer " + accesstoken.access_token
},
"body": JSON.stringify({"token": body6}),
"method": "POST"
});

const body7 = await response7.json()
console.log(" Response status " + response7.status)
console.log(" Response: ", body7)

await setTagValue("accesstoken", {type: 'string', title:'Access token'}, body7)
return true
}

login();