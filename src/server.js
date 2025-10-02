require('dotenv').config();
const app = require('./web/app');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 4000;

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:8081", 
      "http://localhost:8082", 
      "http://localhost:8083",
      "http://localhost:8084",
      "http://localhost:8085",
      "http://localhost:3000",
      "http://127.0.0.1:8081",
      "http://127.0.0.1:8082",
      "http://127.0.0.1:8083",
      "http://127.0.0.1:8084",
      "http://127.0.0.1:8085",
      "http://127.0.0.1:3000",
      "exp://127.0.0.1:8081",
      "exp://127.0.0.1:8083",
      "exp://127.0.0.1:8084",
      "exp://127.0.0.1:8085",
      "exp://localhost:8081",
      "exp://localhost:8083",
      "exp://localhost:8084",
      "exp://localhost:8085"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub; // Changed from decoded.id to decoded.sub
    socket.userRole = decoded.role;
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Store connected users
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  
  // Store user connection
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    role: socket.userRole
  });

  // Join user to their personal room
  socket.join(socket.userId);

  // Handle joining conversation rooms
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  // Handle leaving conversation rooms
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`User ${socket.userId} left conversation ${conversationId}`);
  });

  // Handle new message events
  socket.on('new_message', (data) => {
    // Broadcast to all users in the conversation
    socket.to(`conversation_${data.conversationId}`).emit('message_received', {
      id: data.id,
      message_text: data.message_text,
      sender_id: data.sender_id,
      sender_email: data.sender_email,
      sender_role: data.sender_role,
      conversation_id: data.conversationId,
      created_at: data.created_at
    });
  });

  // Handle message status updates
  socket.on('message_read', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('message_status_update', {
      messageId: data.messageId,
      status: 'read',
      readBy: socket.userId
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    connectedUsers.delete(socket.userId);
  });
});

// Make io available to routes
app.set('io', io);

server.listen(PORT, () => {
  console.log(`OUTY API running on port ${PORT}`);
  console.log(`Socket.IO server ready for real-time messaging`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}. Closing server...`);
  io.close(() => {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});