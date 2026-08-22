import { getSupabase } from '../config/supabase.js';

// In-memory fallback for when Supabase is not configured yet
export const memoryRooms = new Map();

// Initialize demo room for development testing
memoryRooms.set('DEMO12', {
  code: 'DEMO12',
  name: 'Demo Lounge',
  password: '',
  maxMembers: 10,
  members: new Map(),
  messages: [],
  music: { url: '', isPlaying: false, timestamp: 0 },
  emptySince: Date.now()
});

export const roomService = {
  getRooms: async () => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('rooms').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
    return Array.from(memoryRooms.values());
  },
  
  createRoom: async (roomData) => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('rooms').insert([roomData]).select().single();
      if (error) throw error;
      return data;
    }
    
    // In-memory fallback
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
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('rooms').select('*').eq('code', code).eq('is_active', true).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
    return memoryRooms.get(code);
  },
  
  deleteRoom: async (code) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('rooms').update({ is_active: false }).eq('code', code);
      if (error) throw error;
      return true;
    }
    return memoryRooms.delete(code);
  }
};
