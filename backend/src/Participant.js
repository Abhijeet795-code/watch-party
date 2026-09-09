const { v4: uuidv4 } = require("uuid");

const ROLES = Object.freeze({
  HOST: "host",
  MODERATOR: "moderator",
  PARTICIPANT: "participant",
});

class Participant {
  constructor({ socketId, username, role = ROLES.PARTICIPANT }) {
    this.id = uuidv4();
    this.socketId = socketId;
    this.username = username;
    this.role = role;
    this.joinedAt = Date.now();
  }

  setRole(role) {
    this.role = role;
  }

  isHost() {
    return this.role === ROLES.HOST;
  }

  canControlPlayback() {
    return this.role === ROLES.HOST || this.role === ROLES.MODERATOR;
  }

  canManageRoom() {
    return this.role === ROLES.HOST;
  }

  toJSON() {
    return {
      userId: this.id,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
    };
  }
}

module.exports = { Participant, ROLES };
