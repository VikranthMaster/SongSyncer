const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { db, admin } = require("./firebase");

app.use(cors());
const server = http.createServer(app);

// Store both player state AND queue for each room
const roomState = {};

// Initialize io BEFORE using it in functions
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
  res.send("Socket server running ✅");
});

async function add(roomCode, userId) {
  const roomRef = db.collection("rooms").doc(String(roomCode));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);

    if (!snap.exists) {
      tx.set(roomRef, {
        leader: userId,
        members: [userId],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const data = snap.data();
    if (!data.leader) {
      tx.update(roomRef, {
        leader: userId,
        members: admin.firestore.FieldValue.arrayUnion(userId)
      });
      return;
    }

    tx.update(roomRef, {
      members: admin.firestore.FieldValue.arrayUnion(userId),
    });
  });
}

async function getMembers(roomCode) {
  const roomRef = db.collection("rooms").doc(String(roomCode));
  const snap = await roomRef.get();

  if (!snap.exists) return [];
  return snap.data().members || [];
}

async function removeMember(roomCode, name) {
  if (!roomCode || !name) return;

  const roomRef = db.collection("rooms").doc(String(roomCode));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) return;

    const data = snap.data();
    const members = data.members || [];
    const leader = data.leader;

    const updatedMembers = members.filter((m) => m !== name);

    if (updatedMembers.length === 0) {
      tx.delete(roomRef);
      return;
    }

    if (leader === name) {
      tx.update(roomRef, {
        leader: updatedMembers[0],
        members: updatedMembers,
      });
      // Emit after transaction completes
      setImmediate(() => {
        io.to(String(roomCode)).emit("leader_update", updatedMembers[0]);
      });
    } else {
      tx.update(roomRef, {
        members: updatedMembers,
      });
    }
  });
}

io.on("connection", (socket) => {
  // console.log("New connection:", socket.id);

  socket.on("join_room", async (data) => {
    try {
      // console.log("Joining room:", data.roomCode, "socket id:", socket.id);
      
      // Validate input
      if (!data.roomCode || !data.name) {
        console.error("Invalid join_room data:", data);
        return;
      }

      socket.join(String(data.roomCode));
      await add(data.roomCode, data.name);

      socket.roomCode = data.roomCode;
      socket.name = data.name;

      const members = await getMembers(data.roomCode);

      // Initialize room state if it doesn't exist
      if (!roomState[data.roomCode]) {
        roomState[data.roomCode] = {
          queue: [],
          playerState: null
        };
      }

      // Send current queue to the new joiner
      if (roomState[data.roomCode].queue.length > 0) {
        socket.emit("full_queue_sync", roomState[data.roomCode].queue);
      }

      // Send current player state to the new joiner
      if (roomState[data.roomCode].playerState) {
        socket.emit("sync_tick", roomState[data.roomCode].playerState);
      }

      socket.to(String(data.roomCode)).emit("msgrecieve_shit", data.name);
      io.to(String(data.roomCode)).emit("members_update", members);
    } catch (err) {
      console.error("Error in join_room:", err);
    }
  });

  socket.on("end_room", (data) => {
    try {
      // Clean up room state when room ends
      delete roomState[data];
      socket.to(String(data)).emit("disconnect_run", data);
    } catch (err) {
      console.error("Error in end_room:", err);
    }
  });

  socket.on("add_to_queue", (data) => {
    try {
      // Validate input
      if (!data.code || !data.id) {
        console.error("Invalid add_to_queue data:", data);
        return;
      }

      // Update server-side queue
      if (!roomState[data.code]) {
        roomState[data.code] = { queue: [], playerState: null };
      }
      
      if (!roomState[data.code].queue.includes(data.id)) {
        roomState[data.code].queue.push(data.id);
      }

      // Broadcast to all clients including sender
      io.to(String(data.code)).emit("queue_update", data);
    } catch (err) {
      console.error("Error in add_to_queue:", err);
    }
  });

  socket.on("sync_data", (data) => {
    try {
      // Validate input
      if (!data.roomCode) {
        console.error("Invalid sync_data:", data);
        return;
      }

      // Store the latest player state
      if (!roomState[data.roomCode]) {
        roomState[data.roomCode] = { queue: [], playerState: null };
      }
      roomState[data.roomCode].playerState = data;

      socket.to(String(data.roomCode)).emit("sync_tick", data);
    } catch (err) {
      console.error("Error in sync_data:", err);
    }
  });

  socket.on("next_song", (data) => {
    try {
      // Validate input
      if (!data) {
        console.error("Invalid next_song data:", data);
        return;
      }

      // Update server-side queue
      if (roomState[data] && roomState[data].queue.length > 0) {
        roomState[data].queue.shift();
      }

      io.to(String(data)).emit("queue_shift");
    } catch (err) {
      console.error("Error in next_song:", err);
    }
  });

  socket.on("toggle_play", (roomCode) => {
    try {
      if (!roomCode) {
        console.error("Invalid toggle_play roomCode:", roomCode);
        return;
      }

      io.to(String(roomCode)).emit("toggle_play");
    } catch (err) {
      console.error("Error in toggle_play:", err);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const { roomCode, name } = socket;

      if (!roomCode || !name) {
        // console.log("Disconnect without room or name, skipping");
        return;
      }

      // console.log(`User ${name} disconnecting from room ${roomCode}`);

      await removeMember(roomCode, name);

      const members = await getMembers(roomCode);

      // Clean up room state if empty
      if (members.length === 0) {
        delete roomState[roomCode];
        // console.log(`Room ${roomCode} is now empty, state deleted`);
      }

      io.to(String(roomCode)).emit("members_update", members);
      socket.to(String(roomCode)).emit("member_left", name);
    } catch (err) {
      console.error("Error in disconnect:", err);
    }
  });
});


const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`SERVER RUNNING on port ${PORT}`);
});