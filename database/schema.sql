-- Sanu World Database Schema for Supabase / PostgreSQL

-- 1. Users Table (Admin & others if needed)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- Ensure to hash passwords in production!
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Rooms Table
CREATE TABLE rooms (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255),
  creator_nickname VARCHAR(100) NOT NULL,
  max_members INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Room Sessions (Analytics)
CREATE TABLE room_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(10) REFERENCES rooms(code),
  visitor_nickname VARCHAR(100),
  duration_seconds INTEGER,
  message_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Messages (If persistence is needed)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(10) REFERENCES rooms(code),
  sender_nickname VARCHAR(100),
  is_host BOOLEAN DEFAULT false,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Ad Events
CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL, -- 'impression', 'click', etc.
  provider VARCHAR(100),
  revenue_estimate DECIMAL(10, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Revenue Records (Aggregated)
CREATE TABLE revenue_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  estimated_revenue DECIMAL(10, 4) DEFAULT 0.0000,
  confirmed_revenue DECIMAL(10, 4) DEFAULT 0.0000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rooms_is_active ON rooms(is_active);
CREATE INDEX idx_messages_room_code ON messages(room_code);
CREATE INDEX idx_ad_events_created_at ON ad_events(created_at);
