const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const WebSocket = require("ws");
const yUtils = require("y-websocket/bin/utils");
const executeRoute = require("./routes/execute");
const dbRoutes = require("./routes/database");
const streamRoutes = require("./routes/stream");
const userRoutes = require("./routes/users");
const driveRoutes = require("./routes/drives");
const { JSON_BODY_LIMIT } = require("./config/constants");

const app = express();
app.use(express.json({ limit: JSON_BODY_LIMIT }));

// CORS middleware to allow requests from the frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use("/execute", executeRoute);
app.use("/db", dbRoutes);
app.use("/db/users", userRoutes);
app.use("/db/drives", driveRoutes);
app.use("/stream", streamRoutes);

app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      stdout: "",
      stderr: "payload too large",
      exitCode: -1,
      timeMs: 0,
      timedOut: false
    });
  }

  return next(err);
});

app.use((req, res, next) => {
  console.log("api not found:", req.path);
  res.status(404).json({
    success: false,
    stdout: "",
    stderr: "not found",
    exitCode: -1,
    timeMs: 0,
    timedOut: false
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
  });

  socket.on("execution-started", (roomId) => {
    socket.to(roomId).emit("execution-started");
  });

  socket.on("execution-result", (payload) => {
    const { roomId, result } = payload;
    socket.to(roomId).emit("execution-result", result);
  });
});

const wss = new WebSocket.Server({ noServer: true });
wss.on("connection", yUtils.setupWSConnection);

server.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/yjs")) {
    // URL format /yjs/[roomId]
    const docName = request.url.split("/").pop();
    request.url = `/${docName}`; // yUtils expects the doc name in the URL
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Code execution engine listening on port ${port}`);
});
