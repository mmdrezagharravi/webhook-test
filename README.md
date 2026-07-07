# webhook-test

# Webhook Test Server

A simple local server for testing webhook requests.

It receives webhook payloads, saves them in a log file, and shows them in a simple web page.

---

## Install

```bash
mkdir webhook-test-server
cd webhook-test-server
npm init -y
npm install express cors
```

---

## Create `server.js`

Create a file named `server.js` and put the server code inside it.

---

## Run

```bash
node server.js
```

The server will run on:

```txt
http://127.0.0.1:5050
```

---

## Webhook URL

Use this URL in your app:

```txt
http://127.0.0.1:5050/webhook
```

Example:

```json
{
  "notificationUrl": "http://127.0.0.1:5050/webhook",
  "tables": ["TABLE_ID_1", "TABLE_ID_2"],
  "changeTypes": ["recordCreated", "recordUpdated", "recordDeleted"]
}
```

---

## View Logs

Open this address in your browser:

```txt
http://127.0.0.1:5050
```

You can see all received webhook requests there.

---

## API Routes

### Receive webhook

```txt
POST /webhook
```

### Get logs

```txt
GET /logs
```

### Clear logs

```txt
DELETE /logs
```

---

## Notes

If your main app runs inside Docker, `127.0.0.1` may not work.

Use this instead:

```txt
http://host.docker.internal:5050/webhook
```

Or use your machine IP address:

```txt
http://YOUR_IP:5050/webhook
```
