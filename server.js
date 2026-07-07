const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const LOG_FILE = "./webhook-logs.jsonl";

function readLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  return fs
    .readFileSync(LOG_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

function detectEvent(body) {
  const rec = body?.rec;

  if (!rec) return "unknown";

  if (rec.status === "_deleted_record") {
    return "recordDeleted";
  }

  if (rec.createdtime === rec.modifiedtime) {
    return "recordCreated";
  }

  if (rec.changes && rec.changes.length > 0) {
    return "recordUpdated";
  }

  return "unknown";
}

function summarizeLog(log) {
  const body = log.body || {};
  const rec = body.rec || {};

  return {
    time: log.time,
    event: body.event || detectEvent(body),
    base: body.base?.id || body.base || rec.base || "-",
    webhookId: body.webhook?.id || body.webhookId || "-",
    table: body.table?.id || rec.table || "-",
    recordId: rec.id || rec._id || "-",
    status: rec.status || "active",
    modifiedby: rec.modifiedby || "-",
    changesCount: Array.isArray(rec.changes) ? rec.changes.length : 0,
    changedFields: Array.isArray(rec.changes)
      ? rec.changes.map((c) => c.field)
      : [],
  };
}

app.post("/webhook", (req, res) => {
  const log = {
    time: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
  };

  const summary = summarizeLog(log);

  console.log("WEBHOOK RECEIVED:");
  console.table(summary);

  fs.appendFileSync(LOG_FILE, JSON.stringify(log) + "\n");

  res.status(200).json({
    ok: true,
    receivedAt: log.time,
    summary,
  });
});

app.get("/logs", (req, res) => {
  const logs = readLogs();

  res.json(
    logs.map((log) => ({
      summary: summarizeLog(log),
      raw: log,
    })),
  );
});

app.delete("/logs", (req, res) => {
  fs.writeFileSync(LOG_FILE, "");
  res.json({ ok: true, message: "Logs cleared" });
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>Webhook Test Server</title>
  <style>
    body {
      font-family: sans-serif;
      background: #0f172a;
      color: #e5e7eb;
      margin: 0;
      padding: 24px;
    }

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0;
      font-size: 24px;
    }

    button {
      border: 0;
      padding: 10px 14px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 700;
    }

    .refresh {
      background: #2563eb;
      color: white;
    }

    .clear {
      background: #dc2626;
      color: white;
    }

    .stats {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .stat {
      background: #111827;
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 12px 16px;
      min-width: 120px;
    }

    .stat .label {
      color: #94a3b8;
      font-size: 12px;
    }

    .stat .value {
      font-size: 20px;
      margin-top: 6px;
      font-weight: 800;
    }

    .card {
      background: #111827;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 14px;
      direction: ltr;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }

    .event {
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }

    .recordCreated {
      background: #065f46;
      color: #d1fae5;
    }

    .recordUpdated {
      background: #1d4ed8;
      color: #dbeafe;
    }

    .recordDeleted {
      background: #991b1b;
      color: #fee2e2;
    }

    .unknown {
      background: #525252;
      color: #fafafa;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      font-size: 13px;
    }

    .item {
      background: #020617;
      border-radius: 10px;
      padding: 8px;
      overflow-wrap: anywhere;
    }

    .key {
      color: #94a3b8;
      display: block;
      margin-bottom: 4px;
    }

    details {
      margin-top: 12px;
    }

    pre {
      background: #020617;
      color: #cbd5e1;
      padding: 12px;
      border-radius: 12px;
      overflow: auto;
      max-height: 420px;
      direction: ltr;
      text-align: left;
    }

    .empty {
      color: #94a3b8;
      padding: 24px;
      background: #111827;
      border-radius: 16px;
      border: 1px solid #334155;
    }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Webhook Test Server</h1>
      <p>POST /webhook — GET /logs — DELETE /logs</p>
    </div>
    <div>
      <button class="refresh" onclick="loadLogs()">Refresh</button>
      <button class="clear" onclick="clearLogs()">Clear Logs</button>
    </div>
  </div>

  <div class="stats" id="stats"></div>
  <div id="logs"></div>

  <script>
    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    async function loadLogs() {
      const res = await fetch("/logs");
      const logs = await res.json();

      renderStats(logs);
      renderLogs(logs);
    }

    function renderStats(logs) {
      const counts = logs.reduce((acc, item) => {
        const event = item.summary.event || "unknown";
        acc[event] = (acc[event] || 0) + 1;
        return acc;
      }, {});

      document.getElementById("stats").innerHTML = \`
        <div class="stat">
          <div class="label">Total</div>
          <div class="value">\${logs.length}</div>
        </div>
        <div class="stat">
          <div class="label">Created</div>
          <div class="value">\${counts.recordCreated || 0}</div>
        </div>
        <div class="stat">
          <div class="label">Updated</div>
          <div class="value">\${counts.recordUpdated || 0}</div>
        </div>
        <div class="stat">
          <div class="label">Deleted</div>
          <div class="value">\${counts.recordDeleted || 0}</div>
        </div>
      \`;
    }

    function renderLogs(logs) {
      const root = document.getElementById("logs");

      if (!logs.length) {
        root.innerHTML = '<div class="empty">هنوز لاگی دریافت نشده.</div>';
        return;
      }

      root.innerHTML = logs.map((item, index) => {
        const s = item.summary;
        const eventClass = s.event || "unknown";

        return \`
          <div class="card">
            <div class="card-header">
              <span class="event \${eventClass}">\${escapeHtml(s.event)}</span>
              <strong>#\${logs.length - index}</strong>
            </div>

            <div class="grid">
              <div class="item"><span class="key">Time</span>\${escapeHtml(s.time)}</div>
              <div class="item"><span class="key">Status</span>\${escapeHtml(s.status)}</div>
              <div class="item"><span class="key">Base</span>\${escapeHtml(s.base)}</div>
              <div class="item"><span class="key">Table</span>\${escapeHtml(s.table)}</div>
              <div class="item"><span class="key">Webhook</span>\${escapeHtml(s.webhookId)}</div>
              <div class="item"><span class="key">Record</span>\${escapeHtml(s.recordId)}</div>
              <div class="item"><span class="key">Modified By</span>\${escapeHtml(s.modifiedby)}</div>
              <div class="item"><span class="key">Changes Count</span>\${escapeHtml(s.changesCount)}</div>
              <div class="item" style="grid-column: 1 / -1;">
                <span class="key">Changed Fields</span>
                \${escapeHtml((s.changedFields || []).join(", ") || "-")}
              </div>
            </div>

            <details>
              <summary>Raw JSON</summary>
              <pre>\${escapeHtml(JSON.stringify(item.raw.body, null, 2))}</pre>
            </details>
          </div>
        \`;
      }).join("");
    }

    async function clearLogs() {
      await fetch("/logs", { method: "DELETE" });
      await loadLogs();
    }

    loadLogs();
    setInterval(loadLogs, 3000);
  </script>
</body>
</html>
  `);
});

app.listen(5050, "0.0.0.0", () => {
  console.log("Webhook test server running on http://0.0.0.0:5050");
});
