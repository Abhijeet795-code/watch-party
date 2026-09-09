const { customAlphabet } = require("nanoid");
const { Room } = require("./Room");

const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.sweepInterval = setInterval(() => this.sweepEmptyRooms(), SWEEP_INTERVAL_MS);
    this.sweepInterval.unref?.();
  }

  createRoom() {
    let code;
    do {
      code = generateCode();
    } while (this.rooms.has(code));

    const room = new Room({ id: code, io: this.io });
    this.rooms.set(code, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  destroyRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clear();
    this.rooms.delete(roomId);
  }

  deleteRoomIfEmpty(roomId) {
    const room = this.rooms.get(roomId);
    if (room && room.isEmpty()) {
      this.destroyRoom(roomId);
    }
  }

  sweepEmptyRooms() {
    for (const roomId of this.rooms.keys()) {
      this.deleteRoomIfEmpty(roomId);
    }
  }

  stats() {
    return {
      roomCount: this.rooms.size,
      totalParticipants: [...this.rooms.values()].reduce((sum, r) => sum + r.participants.size, 0),
    };
  }
}

module.exports = { RoomManager };
