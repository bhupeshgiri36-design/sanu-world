// In-memory room storage. Rooms live only as long as the server process —
// they reset on every restart/redeploy. That's fine for a chat-room app
// where rooms are meant to be short-lived/live sessions, not permanent data.
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
      music: { url: '', isPlaying: false, timestamp: 0 },
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
