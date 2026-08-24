// LIVE runtime store — this is the single source of truth for everything
// chatSocket.js touches directly (room.members, room.messages, room.music,
// room.pendingDisconnects, room.pendingJoinRequests, room.kickedNicknames).
//
// This app uses a pure in-memory store — there is no external database.
// That means room state (and everything else) lives only as long as this
// process is running: it resets on every restart/redeploy, and it is
// per-process (if this backend is ever scaled to more than one instance,
// room state would need to move to a shared store like Redis).
// For a single Node process this is simple and fast, with no external
// dependency or network hop required to read/write room state.
export const memoryRooms = new Map();

export const roomService = {
  getRooms: async () => {
    return Array.from(memoryRooms.values());
  },

  createRoom: async (roomData) => {
    const code = roomData.code;
    const newRoom = {
      ...roomData,
      members: new Map(),
      messages: [],
      music: { url: '', playing: false, position: 0, timestamp: 0 },
      emptySince: Date.now()
    };
    memoryRooms.set(code, newRoom);
    return newRoom;
  },

  getRoomByCode: async (code) => {
    return memoryRooms.get(code);
  },

  deleteRoom: async (code) => {
    return memoryRooms.delete(code);
  }
};
