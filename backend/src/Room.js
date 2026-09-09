const { ROLES } = require("./Participant");

class Room {
  constructor({ id, io }) {
    this.id = id;
    this.io = io;
    this.participants = new Map();
    this.state = {
      videoId: null,
      playState: "paused",
      currentTime: 0,
      lastUpdated: Date.now(),
    };
    this.chatHistory = [];
    this.createdAt = Date.now();
  }

  addParticipant(participant) {
    this.participants.set(participant.id, participant);
  }

  removeParticipant(participantId) {
    this.participants.delete(participantId);
  }

  getParticipant(participantId) {
    return this.participants.get(participantId);
  }

  findBySocketId(socketId) {
    return [...this.participants.values()].find((p) => p.socketId === socketId);
  }

  isEmpty() {
    return this.participants.size === 0;
  }

  hasHost() {
    return [...this.participants.values()].some((p) => p.isHost());
  }

  promoteNextHost() {
    const candidates = [...this.participants.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    if (candidates.length > 0) {
      candidates[0].setRole(ROLES.HOST);
      return candidates[0];
    }
    return null;
  }

  participantList() {
    return [...this.participants.values()].map((p) => p.toJSON());
  }

  updateState(partial) {
    this.state = { ...this.state, ...partial, lastUpdated: Date.now() };
  }

  addChatMessage(message) {
    this.chatHistory.push(message);
    if (this.chatHistory.length > 100) this.chatHistory.shift();
  }

  clear() {
    this.chatHistory = [];
    this.participants.clear();
    this.state = { videoId: null, playState: "paused", currentTime: 0, lastUpdated: Date.now() };
  }

  broadcast(event, payload) {
    this.io.to(this.id).emit(event, payload);
  }

  broadcastSyncState() {
    this.broadcast("sync_state", { ...this.state, participants: this.participantList() });
  }
}

module.exports = { Room };
