const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = new Map();

function makeCode() {
  let code;
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    startingPoints: room.startingPoints,
    pot: room.pot,
    round: room.round,
    status: room.status,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      balance: p.balance,
      contributed: p.contributed,
      online: p.online
    })),
    history: room.history.slice(-12)
  };
}

function sendRoom(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit("roomUpdate", publicRoom(room));
}

function getPlayer(socket, code) {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found." };
  const player = room.players.get(socket.data.playerId);
  if (!player) return { error: "You are not a member of this room." };
  return { room, player };
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name, startingPoints, playerId }, callback = () => {}) => {
    name = String(name || "").trim().slice(0, 22);
    const points = Math.floor(Number(startingPoints));
    if (!name) return callback({ error: "Enter your name." });
    if (!Number.isSafeInteger(points) || points < 1 || points > 1000000)
      return callback({ error: "Starting points must be between 1 and 1,000,000." });

    const code = makeCode();
    const id = String(playerId || crypto.randomUUID());
    const room = {
      code, hostId: id, startingPoints: points, pot: 0, round: 1,
      status: "open", players: new Map(), history: []
    };
    room.players.set(id, {
      id, name, team: null, balance: points, contributed: 0, online: true
    });
    rooms.set(code, room);
    socket.data.playerId = id;
    socket.data.roomCode = code;
    socket.join(code);
    callback({ ok: true, code, playerId: id });
    sendRoom(code);
  });

  socket.on("joinRoom", ({ code, name, playerId }, callback = () => {}) => {
    code = String(code || "").trim().toUpperCase();
    name = String(name || "").trim().slice(0, 22);
    const room = rooms.get(code);
    if (!room) return callback({ error: "Room code not found." });
    if (!name) return callback({ error: "Enter your name." });
    const id = String(playerId || crypto.randomUUID());
    let player = room.players.get(id);
    if (!player) {
      player = { id, name, team: null, balance: room.startingPoints, contributed: 0, online: true };
      room.players.set(id, player);
    } else {
      player.name = name;
      player.online = true;
    }
    socket.data.playerId = id;
    socket.data.roomCode = code;
    socket.join(code);
    callback({ ok: true, code, playerId: id });
    sendRoom(code);
  });

  socket.on("chooseTeam", ({ code, team }, callback = () => {}) => {
    const found = getPlayer(socket, code);
    if (found.error) return callback({ error: found.error });
    if (!["A", "B"].includes(team)) return callback({ error: "Choose Team A or Team B." });
    if (found.room.status !== "open") return callback({ error: "This round has already been settled." });
    found.player.team = team;
    callback({ ok: true });
    sendRoom(code);
  });

  socket.on("contribute", ({ code, amount }, callback = () => {}) => {
    const found = getPlayer(socket, code);
    if (found.error) return callback({ error: found.error });
    const { room, player } = found;
    amount = Math.floor(Number(amount));
    if (room.status !== "open") return callback({ error: "The round is closed. Start the next round first." });
    if (!player.team) return callback({ error: "Choose a team first." });
    if (!Number.isSafeInteger(amount) || amount < 1) return callback({ error: "Enter a positive whole number of points." });
    if (amount > player.balance) return callback({ error: "You don't have enough points." });
    player.balance -= amount;
    player.contributed += amount;
    room.pot += amount;
    callback({ ok: true });
    sendRoom(code);
  });

  socket.on("resolveRound", ({ code, winner }, callback = () => {}) => {
    const found = getPlayer(socket, code);
    if (found.error) return callback({ error: found.error });
    const { room, player } = found;
    if (player.id !== room.hostId) return callback({ error: "Only the room host can select the winner." });
    if (room.status !== "open") return callback({ error: "This round is already settled." });
    if (!["A", "B"].includes(winner)) return callback({ error: "Select a winning team." });
    if (room.pot <= 0) return callback({ error: "There are no points in the pot." });

    const winners = [...room.players.values()].filter(p => p.team === winner);
    if (!winners.length) return callback({ error: "No players have joined that team." });

    const total = room.pot;
    const share = Math.floor(total / winners.length);
    let remainder = total - share * winners.length;
    winners.forEach(p => {
      p.balance += share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    });

    room.history.push({
      round: room.round,
      winner,
      pot: total,
      winners: winners.map(p => p.name)
    });
    room.pot = 0;
    room.players.forEach(p => { p.contributed = 0; p.team = null; });
    room.status = "settled";
    callback({ ok: true });
    sendRoom(code);
  });

  socket.on("nextRound", ({ code }, callback = () => {}) => {
    const found = getPlayer(socket, code);
    if (found.error) return callback({ error: found.error });
    if (found.player.id !== found.room.hostId) return callback({ error: "Only the host can start the next round." });
    if (found.room.status !== "settled") return callback({ error: "Settle the current round first." });
    found.room.round++;
    found.room.status = "open";
    callback({ ok: true });
    sendRoom(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const id = socket.data.playerId;
    const room = rooms.get(code);
    if (room && id && room.players.has(id)) {
      room.players.get(id).online = false;
      sendRoom(code);
    }
  });
});

server.listen(PORT, () => console.log(`Game server listening on ${PORT}`));