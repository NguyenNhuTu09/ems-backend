
const { Server } = require("socket.io");
const corsOptions = require("./cors");

/**
 * Khởi tạo WebSocket server
 * Tương đương @EnableWebSocketMessageBroker + registerStompEndpoints()
 */
function initWebSocket(httpServer) {
  const io = new Server(httpServer, {
    path: "/ws",
    cors: corsOptions,
  });

  io.on("connection", (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Client join vào một topic/room
    // Tương đương subscribe("/topic/...") bên STOMP
    socket.on("join", (room) => {
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room: ${room}`);
    });

    socket.on("leave", (room) => {
      socket.leave(room);
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Gửi message tới tất cả client trong một topic
 * Tương đương messagingTemplate.convertAndSend("/topic/<room>", payload)
 *
 * Cách dùng trong controller/service:
 *   const io = req.app.get("io");
 *   broadcastToTopic(io, "notifications", { message: "Hello" });
 */
function broadcastToTopic(io, room, payload) {
  io.to(room).emit(`topic:${room}`, payload);
}

module.exports = { initWebSocket, broadcastToTopic };