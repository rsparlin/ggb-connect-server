#!/bin/bash
ORIGIN="http://localhost:8080"
SID="c55d57b8-8624-11e9-bc42-526af7764f64"

node dist/socketTest.js "$SID" &

curl -s "$ORIGIN/handshake?sessionId=$SID&version=9001"
curl -s -X POST "$ORIGIN/command" -d "sessionId=$SID&command=f:x=y"
curl -s "$ORIGIN/getCurrSession?sessionId=$SID" > /dev/null
curl -s -X POST "$ORIGIN/saveCurrSession" -d "sessionId=$SID" > /dev/null
curl -s "$ORIGIN/getPNG?sessionId=$SID" > "$SID.png"
curl -s -X POST "$ORIGIN/appExec" \
  --header 'content-type: application/json' \
  --data '{
	"sessionId": "c55d57b8-8624-11e9-bc42-526af7764f64",
	"property": "getValueString",
	"args": [ "f" ]
  }';

kill %1

