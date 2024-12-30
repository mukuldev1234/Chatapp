require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Models
const Room = require('./models/Room');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://127.0.0.1:5500',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

// API Routes
app.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({});
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

app.post('/rooms', async (req, res) => {
  const { name, privacy, password } = req.body;
  try {
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ message: 'Room already exists' });
    }
    const newRoom = new Room({ name, privacy, password });
    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create room' });
  }
});

// WebSocket Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle room joining
  socket.on('joinRoom', async ({ room, password }) => {
    try {
      const roomDoc = await Room.findOne({ name: room });

      if (!roomDoc) {
        return socket.emit('error', 'Room not found');
      }

      if (roomDoc.privacy === 'private' && roomDoc.password !== password) {
        return socket.emit('error', 'Incorrect password');
      }

      socket.join(room);
      console.log(`User ${socket.id} joined room: ${room}`);
      io.to(room).emit('notification', `${socket.id} has joined the room.`);
      socket.emit('success', 'You have joined the room.');

      // Fetch and send previous messages for the room
      const messages = await Message.find({ room }).sort({ timestamp: 1 });
      socket.emit('previousMessages', messages);
    } catch (error) {
      console.error(error);
      socket.emit('error', 'Error joining room');
    }
  });

  // Handle sending messages
  socket.on('message', async ({ room, username, message }) => {
    try {
      const newMessage = new Message({
        room,
        username,
        message,
        timestamp: new Date(),
      });
      await newMessage.save();

      io.to(room).emit('message', {
        username,
        message,
        timestamp: newMessage.timestamp,
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
