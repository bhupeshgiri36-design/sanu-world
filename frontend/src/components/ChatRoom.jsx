// frontend/src/components/ChatRoom.jsx

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../lib/socket';
import { Send, Users, LogOut, Share2, Menu, X, CheckCircle2, Image as ImageIcon, Music, Heart, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TopAd from './ads/TopAd';
import BottomAd from './ads/BottomAd';
import MusicSearch from './music/MusicSearch';
import MusicPlayer from './music/MusicPlayer';

export default function ChatRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [showSidebar, setShowSidebar] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Join state
  const [joinStep, setJoinStep] = useState('checking'); // 'checking' | 'intro' | 'form' | 'joined' | 'error'
  const [roomInfo, setRoomInfo] = useState(null);
  const [isHost, setIsHost] = useState(false);
  
  const [joinNickname, setJoinNickname] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected' | 'reconnecting'
  const [peerStatus, setPeerStatus] = useState(null); // null | { nickname, isHost }
  const hasJoinedRef = useRef(false);
  const isHostRef = useRef(false);
  
  const fileInputRef = useRef(null);

  // Music player state — new local-only player (Step 5.3). The legacy
  // pasted-URL "Shared Music Bar" and its socket-based set-music/music-state
  // events have been removed per request; this collapses into a compact
  // "Now Playing" bar once a track is picked so it doesn't dominate the
  // screen on mobile.
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showMusicSearch, setShowMusicSearch] = useState(true);

  const socket = getSocket();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [room?.messages]);

  useEffect(() => {
    if (!code) return navigate('/');

    const checkRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || 'Room not found');
          setJoinStep('error');
          return;
        }

        setRoomInfo(data);

        const credentialsStr = sessionStorage.getItem(`room_${code}`);
        if (credentialsStr) {
          const credentials = JSON.parse(credentialsStr);
          connectToRoom(credentials.nickname, credentials.password);
        } else {
          setJoinStep('intro');
        }
      } catch (err) {
        setError('Failed to connect to server');
        setJoinStep('error');
      }
    };

    checkRoom();

    return () => {
      socket.off('receive-message');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('online-count');
      socket.off('music-update');
      socket.off('user-disconnected');
      socket.off('user-reconnected');
      hasJoinedRef.current = false;
      socket.disconnect();
    };
  }, [code, navigate, socket]);

  const handleDrop = () => {
    if (hasJoinedRef.current) setConnectionStatus('reconnecting');
  };

  const handleReconnect = () => {
    if (!hasJoinedRef.current) return;
    const credentialsStr = sessionStorage.getItem(`room_${code}`);
    if (!credentialsStr) return;
    const { nickname, password } = JSON.parse(credentialsStr);
    socket.emit('join-room', { roomCode: code, nickname, password }, (response) => {
      if (response.error) {
        setError(response.error);
        setJoinStep('error');
        return;
      }
      setRoom(response.room);
      setOnlineCount(response.room.members.length);
      setConnectionStatus('connected');
    });
  };

  useEffect(() => {
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDrop);
    return () => {
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDrop);
    };
  }, [socket, code]);

  const connectToRoom = (nickname, password) => {
    setIsJoining(true);
    socket.connect();
    socket.emit('join-room', { roomCode: code, nickname, password }, (response) => {
      setIsJoining(false);
      if (response.error) {
        setError(response.error);
        setJoinStep('error');
        if (response.error === 'Invalid password' || response.error === 'This room is full') {
          sessionStorage.removeItem(`room_${code}`);
        }
      } else {
        setRoom(response.room);
        setOnlineCount(response.room.members.length);
        setIsHost(response.isHost);
        isHostRef.current = response.isHost;
        setJoinStep('joined');
        setConnectionStatus('connected');
        hasJoinedRef.current = true;
      }
    });

    socket.on('receive-message', (message) => {
      setRoom((prev) => prev ? { ...prev, messages: [...prev.messages, message] } : prev);
    });

    socket.on('user-joined', (user) => {
      setRoom((prev) => prev ? { ...prev, members: [...prev.members, user] } : prev);
    });

    socket.on('user-left', (userId) => {
      setRoom((prev) => prev ? { ...prev, members: prev.members.filter(m => m.id !== userId) } : prev);
      setPeerStatus(null);
    });

    socket.on('user-disconnected', (info) => {
      setPeerStatus(info);
    });

    socket.on('user-reconnected', () => {
      setPeerStatus(null);
    });

    socket.on('online-count', (count) => {
      setOnlineCount(count);
    });

    socket.on('music-update', (musicState) => {
      setRoom((prev) => prev ? { ...prev, music: musicState } : prev);
    });

    socket.on('room-closed', (payload) => {
      sessionStorage.removeItem(`room_${code}`);
      if (isHostRef.current) {
        setJoinStep('host-goodbye');
        setTimeout(() => navigate('/'), 2000);
      } else {
        const endedBy = payload?.endedBy;
        const reason = endedBy === 'admin'
          ? 'This room was closed by an admin'
          : 'Sanu has ended the chat';
        navigate('/goodbye', { state: { reason } });
      }
    });
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!joinNickname.trim()) return;
    sessionStorage.setItem(`room_${code}`, JSON.stringify({ nickname: joinNickname, password: joinPassword }));
    connectToRoom(joinNickname, joinPassword);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    socket.emit('send-message', text, (response) => {
      if (response && response.error) {
        console.error(response.error);
        setInputText(text);
      }
    });
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      socket.emit('send-message', base64, (response) => {
        if (response && response.error) console.error(response.error);
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEndConversation = () => {
    socket.emit('end-room', null, (response) => {
      if (response?.error) {
        setError(response.error);
        return;
      }
      sessionStorage.removeItem(`room_${code}`);
      setJoinStep('host-goodbye');
      setTimeout(() => navigate('/'), 2000);
    });
  };

  const handleLeave = () => {
    socket.emit('leave-room');
    socket.disconnect();
    sessionStorage.removeItem(`room_${code}`);
    navigate('/');
  };

  if (joinStep === 'host-goodbye') {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#151518] p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-white/5 backdrop-blur-xl flex flex-col items-center"
        >
          <div className="text-[#f472b6] mb-6"><Heart size={48} className="fill-[#f472b6]" /></div>
          <h2 className="text-2xl font-serif text-white mb-4 tracking-wide">
            Goodbye
          </h2>
          <p className="text-zinc-400 mb-8 font-light">
            Thanks for chatting!
          </p>
          <div className="flex gap-2">
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          </div>
          <p className="text-zinc-600 mt-6 text-xs tracking-widest uppercase">Redirecting...</p>
        </motion.div>
      </div>
    );
  }

  if (joinStep === 'checking') {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-serif text-white tracking-wide mb-6">SANU WORLD</h1>
        <p className="text-zinc-500 font-sans tracking-widest text-sm uppercase mb-4">Loading room...</p>
        <div className="flex gap-2">
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#ff8bb3]" />
        </div>
      </div>
    );
  }

  if (joinStep === 'error') {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4">
        <div className="bg-[#151518] p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center border border-white/5 backdrop-blur-xl">
          <div className="text-red-400 mb-6 flex justify-center"><X size={48} /></div>
          <h2 className="text-2xl font-serif text-white mb-2 tracking-wide">Oops!</h2>
          <p className="text-zinc-400 mb-8 font-light">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-white hover:bg-zinc-200 text-zinc-950 font-medium py-3 px-8 rounded-full transition-colors shadow-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (joinStep === 'intro' && roomInfo) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-[#ff8bb3]/5 blur-[150px] rounded-full pointer-events-none" />
        <div className="w-full max-w-md relative z-10 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#151518] p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 backdrop-blur-xl text-center"
          >
            <h3 className="font-serif text-xl tracking-wide text-white opacity-60 mb-6 flex items-center justify-center gap-2">
              <Heart size={16} className="text-[#f472b6] fill-[#f472b6]" /> SANU WORLD
            </h3>
            <h2 className="text-3xl font-serif text-white mb-2">
              {roomInfo.name}
            </h2>
            
            <div className="flex justify-center items-center gap-2 text-green-400 font-medium text-sm mb-8">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Sanu is online</span>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-8 border border-red-500/20 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-6 text-left">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Your Name</label>
                <input
                  type="text"
                  required
                  value={joinNickname}
                  onChange={(e) => setJoinNickname(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all text-center text-lg"
                  maxLength={20}
                />
              </div>
              
              {roomInfo?.requiresPassword && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Room password"
                    className="w-full px-5 py-4 bg-[#0D0D0F] border border-zinc-800 rounded-2xl focus:outline-none focus:border-[#ff8bb3] text-white placeholder-zinc-600 transition-all text-center text-lg"
                  />
                </div>
              )}

              <TopAd />

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isJoining || !joinNickname.trim()}
                className="w-full bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 font-bold py-4 px-4 rounded-full transition-all tracking-wider text-sm shadow-[0_5px_15px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
              >
                {isJoining ? 'Joining...' : 'Join Sanu \u2192'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col h-screen max-h-screen overflow-hidden text-zinc-100">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 px-5 py-4 flex flex-col gap-3 shrink-0 z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 text-zinc-400 md:hidden transition-colors"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight tracking-wide">{room.name}</h1>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                {connectionStatus === 'reconnecting' ? (
                  <span className="flex items-center gap-1.5 font-medium text-yellow-400">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                    Reconnecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-pink-400">
                    <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"></div>
                    {onlineCount} online
                  </span>
                )}
                <span className="text-zinc-600">•</span>
                <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-300 font-bold tracking-widest">{room.code}</span>
                {peerStatus && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="flex items-center gap-1.5 font-medium text-yellow-400">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                      {peerStatus.nickname} reconnecting...
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-zinc-700"
              title="Share Room Link"
            >
              {copied ? <CheckCircle2 size={16} className="text-pink-400" /> : <Share2 size={16} />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
            </button>
            {isHost ? (
              <button
                onClick={() => {
                  if (window.confirm('End the conversation for both of you?')) {
                    handleEndConversation();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-sm font-semibold transition-colors border border-red-500/20"
                title="End Conversation"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">End Conversation</span>
              </button>
            ) : (
              <button
                onClick={handleLeave}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                title="Leave Room"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
        
        {/* Music panel (Step 5.3, local-only, no sync yet). Legacy pasted-URL
            bar removed per request. Collapses to a compact "Now Playing" row
            once a track is picked, so search results never take over the
            screen on mobile — tap "Change Song" to reopen search. */}
        {isHost && (
          <div className="w-full flex flex-col gap-2 pt-1">
            {showMusicSearch ? (
              <div className="flex flex-col gap-2">
                {selectedTrack && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-zinc-500">Choose a song</span>
                    <button
                      type="button"
                      onClick={() => setShowMusicSearch(false)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <MusicSearch
                  isHost={isHost}
                  onSelectTrack={(track) => {
                    setSelectedTrack(track);
                    setShowMusicSearch(false);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-950/60 backdrop-blur-md rounded-xl p-2 border border-zinc-700/50 w-full shadow-inner">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                  <Music size={16} />
                </div>
                <span className="text-xs font-medium text-zinc-300 truncate flex-1">
                  {selectedTrack ? `${selectedTrack.title} — ${selectedTrack.artist}` : 'No song selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowMusicSearch(true)}
                  className="text-xs font-bold text-pink-400 hover:text-pink-300 px-3 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors shrink-0"
                >
                  {selectedTrack ? 'Change Song' : 'Search Music'}
                </button>
              </div>
            )}
            <MusicPlayer track={selectedTrack} />
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="w-full bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800 flex items-center justify-center shrink-0 z-10 py-2 px-4">
            <TopAd />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
            {room.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                <Send size={48} className="opacity-20" />
                <p className="font-medium tracking-wide">No messages yet. Say hello!</p>
              </div>
            ) : (
              room.messages.map((msg, idx) => {
                const isMe = msg.userId === socket.id;
                const showHeader = idx === 0 || room.messages[idx - 1].userId !== msg.userId || (msg.timestamp - room.messages[idx - 1].timestamp > 60000);
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showHeader && (
                      <div className={`text-xs text-zinc-500 mb-1.5 flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="font-semibold text-zinc-300">{isMe ? 'You' : msg.nickname}</span>
                        <span className="text-[10px] opacity-60">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <div 
                      className={`max-w-[85%] sm:max-w-[75%] px-5 py-3 break-words shadow-md backdrop-blur-md ${
                        isMe 
                          ? 'bg-gradient-to-br from-pink-500/80 to-fuchsia-600/80 text-white rounded-2xl rounded-tr-sm font-medium border border-pink-400/30 shadow-[0_5px_15px_rgba(236,72,153,0.3)]' 
                          : 'bg-zinc-800/60 text-zinc-100 rounded-2xl rounded-tl-sm border border-zinc-700/50'
                      }`}
                    >
                      {msg.type === 'image' ? (
                        <a href={msg.text} target="_blank" rel="noreferrer">
                          <img src={msg.text} alt="Shared" className="rounded-xl max-h-64 object-contain" />
                        </a>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="w-full bg-zinc-900/50 backdrop-blur-md border-t border-zinc-800 flex items-center justify-center shrink-0 z-10 py-2 px-4">
            <BottomAd />
          </div>

          <div className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
              <button
                type="button"
                onClick={handleImageClick}
                className="p-3.5 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-zinc-800 text-pink-400 hover:bg-zinc-700"
                title="Upload Image"
              >
                <ImageIcon size={20} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
              />
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-5 py-3.5 h-[52px] bg-zinc-950 border border-zinc-800 focus:bg-zinc-950 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 rounded-2xl transition-all outline-none text-zinc-100 placeholder-zinc-500"
                maxLength={1000}
              />
              <motion.button
                whileHover={{ scale: 1.05, rotate: 2, y: -2 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!inputText.trim()}
                className="px-5 py-3.5 h-[52px] bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.5)]"
              >
                <Send size={20} className={inputText.trim() ? "translate-x-0.5" : ""} />
              </motion.button>
            </form>
          </div>
        </main>

        {/* Sidebar */}
        <aside 
          className={`
            absolute md:static inset-y-0 right-0 w-64 bg-zinc-900 border-l border-zinc-800 shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out z-20 flex flex-col
            ${showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900 shrink-0">
            <h3 className="font-bold text-zinc-100 flex items-center gap-2 tracking-wide">
              <Users size={18} className="text-zinc-400" />
              Members
            </h3>
            <button 
              onClick={() => setShowSidebar(false)}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {room.members.map(member => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-800/80 transition-colors cursor-default">
                  <div className="relative">
                    <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-200 font-bold text-sm shadow-inner">
                      {member.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-pink-500 border-2 border-zinc-900 rounded-full shadow-sm"></div>
                  </div>
                  <span className="text-sm font-semibold text-zinc-200 truncate">
                    {member.nickname} {member.id === socket.id && <span className="text-zinc-500 font-normal ml-1">(You)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {showSidebar && (
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 md:hidden transition-opacity"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </div>

    </div>
  );
}