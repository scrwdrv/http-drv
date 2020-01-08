"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const https = require("https");
const req = https.request({
    host: 'www.google.com',
    port: 443,
    path: '/',
    method: 'POST'
}, res => {
    res.on('data', d => {
        console.log(d);
    });
});
req.on('error', e => {
    console.log(e);
});
req.end();
