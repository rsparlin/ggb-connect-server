## ggb-connect-server API Specification

```
/handshake
  Method: GET
  Parameters:
    - id: uuid string
    - version: version number string
  Response body (JSON): { sessionId, webhookLink }
  Response code 200 on success.
/command
  Method: POST
  Accepted content-types: application/json, application/x-www-form-urlencoded
  Parameters:
    - command: string
    - sessionId: string
  Response body: N/A
  Reponse code 200 on success.
/getCurrSession
  Method: GET
  Parameters:
    - sessionId: string
  Response body: ggbApplet.getXML() string
  Response code 200 on success.
/saveCurrSession
  Method: POST
  Accepted content-types: application/json, application/x-www-form-urlencoded
  Parameters:
    - sessionId: string
  Writes ggbApplet.getXML() string for specified session to database.
  Response body: ggbApplet.getXML() string
  Response code 200 on success.
/appExec
  Method: POST
  Accepted content-types: application/json, application/x-www-form-urlencoded
  Parameters:
    - sessionId: string
    - property: string
    - args: string[]
  Response body: N/A
  Reponse code 200 on success.
```
