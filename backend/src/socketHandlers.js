const { Participant, ROLES } = require("./Participant");

function registerSocketHandlers(io, socket, roomManager) {
  let currentRoomId = null;
  let participantId = null;

  function getRoomOrWarn() {
    const room = currentRoomId && roomManager.getRoom(currentRoomId);
    if (!room) {
      socket.emit("error_message", { message: "You are not in a room." });
      return null;
    }
    return room;
  }

  function getSelfOrWarn(room) {
    const self = room.getParticipant(participantId);
    if (!self) {
      socket.emit("error_message", { message: "Participant not found in room." });
      return null;
    }
    return self;
  }

  function requirePlaybackPermission(room) {
    const self = getSelfOrWarn(room);
    if (!self) return null;
    if (!self.canControlPlayback()) {
      socket.emit("error_message", { message: "You do not have permission to control playback." });
      return null;
    }
    return self;
  }

  function requireHostPermission(room) {
    const self = getSelfOrWarn(room);
    if (!self) return null;
    if (!self.canManageRoom()) {
      socket.emit("error_message", { message: "Only the host can do that." });
      return null;
    }
    return self;
  }

  socket.on("create_room", ({ username } = {}, ack) => {
    if (!username || !username.trim()) {
      return ack?.({ ok: false, error: "Username is required." });
    }

    const room = roomManager.createRoom();
    const host = new Participant({ socketId: socket.id, username: username.trim(), role: ROLES.HOST });
    room.addParticipant(host);

    socket.join(room.id);
    currentRoomId = room.id;
    participantId = host.id;

    ack?.({
      ok: true,
      roomId: room.id,
      userId: host.id,
      role: host.role,
      state: room.state,
      participants: room.participantList(),
    });
  });

  socket.on("join_room", ({ roomId, username } = {}, ack) => {
    const room = roomId && roomManager.getRoom(roomId.toUpperCase());
    if (!room) {
      return ack?.({ ok: false, error: "Room not found." });
    }
    if (!username || !username.trim()) {
      return ack?.({ ok: false, error: "Username is required." });
    }

    const role = room.hasHost() ? ROLES.PARTICIPANT : ROLES.HOST;
    const participant = new Participant({ socketId: socket.id, username: username.trim(), role });
    room.addParticipant(participant);

    socket.join(room.id);
    currentRoomId = room.id;
    participantId = participant.id;

    ack?.({
      ok: true,
      roomId: room.id,
      userId: participant.id,
      role: participant.role,
      state: room.state,
      participants: room.participantList(),
    });

    socket.to(room.id).emit("user_joined", {
      username: participant.username,
      userId: participant.id,
      role: participant.role,
      participants: room.participantList(),
    });

    socket.emit("chat_history", room.chatHistory);
  });

  socket.on("leave_room", () => {
    handleDisconnectOrLeave();
  });

  socket.on("disconnect", () => {
    handleDisconnectOrLeave();
  });

  function handleDisconnectOrLeave() {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (!room) return;

    const leaving = room.getParticipant(participantId);
    if (!leaving) return;

    const wasHost = leaving.isHost();
    room.removeParticipant(participantId);
    socket.leave(currentRoomId);

    if (!room.isEmpty()) {
      let newHost = null;
      if (wasHost) {
        newHost = room.promoteNextHost();
      }
      room.broadcast("user_left", {
        username: leaving.username,
        userId: leaving.id,
        participants: room.participantList(),
      });
      if (newHost) {
        room.broadcast("role_assigned", {
          userId: newHost.id,
          username: newHost.username,
          role: newHost.role,
          participants: room.participantList(),
        });
      }
    } else {
      roomManager.deleteRoomIfEmpty(currentRoomId);
    }

    currentRoomId = null;
    participantId = null;
  }

  socket.on("play", ({ currentTime } = {}) => {
    const room = getRoomOrWarn();
    if (!room || !requirePlaybackPermission(room)) return;
    room.updateState({ playState: "playing", currentTime: currentTime ?? room.state.currentTime });
    room.broadcastSyncState();
  });

  socket.on("pause", ({ currentTime } = {}) => {
    const room = getRoomOrWarn();
    if (!room || !requirePlaybackPermission(room)) return;
    room.updateState({ playState: "paused", currentTime: currentTime ?? room.state.currentTime });
    room.broadcastSyncState();
  });

  socket.on("seek", ({ time } = {}) => {
    const room = getRoomOrWarn();
    if (!room || !requirePlaybackPermission(room)) return;
    if (typeof time !== "number") return;
    room.updateState({ currentTime: time });
    room.broadcastSyncState();
  });

  socket.on("change_video", ({ videoId } = {}) => {
    const room = getRoomOrWarn();
    if (!room || !requirePlaybackPermission(room)) return;
    if (!videoId) return;
    room.updateState({ videoId, playState: "paused", currentTime: 0 });
    room.broadcastSyncState();
  });

  socket.on("assign_role", ({ userId, role } = {}) => {
    const room = getRoomOrWarn();
    if (!room || !requireHostPermission(room)) return;
    if (![ROLES.MODERATOR, ROLES.PARTICIPANT].includes(role)) {
      return socket.emit("error_message", { message: "Invalid role." });
    }
    const target = room.getParticipant(userId);
    if (!target) return socket.emit("error_message", { message: "Participant not found." });
    if (target.isHost()) return socket.emit("error_message", { message: "Cannot change the host's role this way." });

    target.setRole(role);
    room.broadcast("role_assigned", {
      userId: target.id,
      username: target.username,
      role: target.role,
      participants: room.participantList(),
    });
  });

  socket.on("transfer_host", ({ userId } = {}) => {
    const room = getRoomOrWarn();
    const self = requireHostPermission(room || {});
    if (!room || !self) return;
    const target = room.getParticipant(userId);
    if (!target) return socket.emit("error_message", { message: "Participant not found." });

    self.setRole(ROLES.MODERATOR);
    target.setRole(ROLES.HOST);

    room.broadcast("role_assigned", {
      userId: target.id,
      username: target.username,
      role: target.role,
      participants: room.participantList(),
    });
    room.broadcast("role_assigned", {
      userId: self.id,
      username: self.username,
      role: self.role,
      participants: room.participantList(),
    });
  });

  socket.on("remove_participant", ({ userId } = {}) => {
    const room = getRoomOrWarn();
    if (!room || !requireHostPermission(room)) return;
    const target = room.getParticipant(userId);
    if (!target) return socket.emit("error_message", { message: "Participant not found." });
    if (target.isHost()) return socket.emit("error_message", { message: "Host cannot remove themselves." });

    room.removeParticipant(userId);
    room.broadcast("participant_removed", { userId, participants: room.participantList() });

    io.to(target.socketId).emit("you_were_removed");
    io.sockets.sockets.get(target.socketId)?.leave(room.id);
  });

  socket.on("end_meeting", () => {
    const room = getRoomOrWarn();
    if (!room || !requireHostPermission(room)) return;

    room.broadcast("meeting_ended", {});
    io.in(room.id).socketsLeave(room.id);
    roomManager.destroyRoom(room.id);

    currentRoomId = null;
    participantId = null;
  });

  socket.on("chat_message", ({ text } = {}) => {
    const room = getRoomOrWarn();
    if (!room) return;
    const self = getSelfOrWarn(room);
    if (!self || !text || !text.trim()) return;

    const message = {
      userId: self.id,
      username: self.username,
      text: text.trim().slice(0, 500),
      timestamp: Date.now(),
    };
    room.addChatMessage(message);
    room.broadcast("chat_message", message);
  });
}

module.exports = { registerSocketHandlers };
