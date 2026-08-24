import { getSupabase } from '../config/supabase.js';

// LIVE runtime cache — this is the source of truth for everything
// chatSocket.js touches directly (room.members, room.messages, room.music,
// room.pendingDisconnects, room.pendingJoinRequests, room.kickedNicknames).
// It exists REGARDLESS of whether Supabase is configured.
export const memoryRooms = new Map();

memoryRooms.set('DEMO12', {
  code: 'DEMO12',
  name: 'Demo Lounge',
  password: '',
  creatorNickname: 'Sanu',
  maxMembers: 10,
  members: new Map(),
  messages: [],
  music: { url: '', playing: false, position: 0, timestamp: 0 },
  emptySince: Date.now()
});

// The `rooms` table uses snake_case columns (creator_nickname, max_members)
// while the rest of the backend works in camelCase. Mixing the two is what
// caused room creation to fail as soon as Supabase was configured.
function dbRowToRuntimeFields(row) {
  return {
    code: row.code,
    name: row.name,
    password: row.password || '',
    creatorNickname: row.creator_nickname,
    maxMembers: row.max_members,
  };
}

function runtimeToDbInsert({ code, name, password, creatorNickname, maxMembers }) {
  return {
    code,
    name,
    password: password || null,
    creator_nickname: creatorNickname,
    max_members: maxMembers,
    is_active: true,
  };
}

function hydrate(row) {
  const existing = memoryRooms.get(row.code);
  if (existing) return existing;
  const runtime = {
    ...dbRowToRuntimeFields(row),
    members: new Map(),
    messages: [],
    music: { url: '', playing: false, position: 0, timestamp: 0 },
    emptySince: Date.now()
  };
  memoryRooms.set(row.code, runtime);
  return runtime;
}

export const roomService = {
  getRooms: async () => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('rooms').select('*').eq('is_active', true);
      if (error) throw error;
      return data.map(hydrate);
    }
    return Array.from(memoryRooms.values());
  },

  createRoom: async (roomData) => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('rooms')
        .insert([runtimeToDbInsert(roomData)])
        .select()
        .single();
      if (error) throw error;
      return hydrate(data);
    }

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
    const supabase = getSupabase();
    if (supabase) {
      const live = memoryRooms.get(code);
      if (live) return live;

      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }
      return data ? hydrate(data) : undefined;
    }
    return memoryRooms.get(code);
  },

  deleteRoom: async (code) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('rooms').update({ is_active: false }).eq('code', code);
      if (error) throw error;
    }
    return memoryRooms.delete(code);
  }
};
