import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { io, Socket } from 'socket.io-client';
import { api, getToken, getUser, clearToken, setUser, SOCKET_URL } from '../lib/api';
import Avatar from '../components/Avatar';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Message {
  _id: string;
  sender: User;
  receiver: User;
  content: string;
  createdAt: string;
  read: boolean;
}

export default function Chat() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showProfile, setShowProfile] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auth check
  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) { router.push('/login'); return; }
    setCurrentUser(user);
  }, []);

  // Socket setup
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    s.on('newMessage', (msg: Message) => {
      // Guard: ignore malformed messages with null sender
      if (!msg || !msg.sender) return;

      setMessages(prev => {
        const exists = prev.find(m => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
      setUnreadCounts(prev => {
        const senderId =
          typeof msg.sender === 'string'
            ? msg.sender
            : msg.sender?._id;
        if (!senderId) return prev;
        const currentSel = selectedUserRef.current;
        if (currentSel && currentSel._id === senderId) {
          s.emit('markRead', { senderId });
          return prev;
        }
        return { ...prev, [senderId]: (prev[senderId] || 0) + 1 };
      });
    });

    s.on('messageSent', (msg: Message) => {
      if (!msg || !msg.sender) return;
      setMessages(prev => {
        const exists = prev.find(m => m._id === msg._id);
        if (exists) return prev;
        return [...prev, msg];
      });
    });

    s.on('userStatus', ({ userId, isOnline, lastSeen }: any) => {
      setUsers(prev => prev.map(u =>
        u._id === userId ? { ...u, isOnline, lastSeen } : u
      ));
      setSelectedUser(prev =>
        prev?._id === userId ? { ...prev, isOnline, lastSeen } : prev
      );
    });

    s.on('typing', ({ senderId, isTyping }: any) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        isTyping ? next.add(senderId) : next.delete(senderId);
        return next;
      });
    });

    s.on('messagesRead', () => {
      setMessages(prev => prev.map(m => ({ ...m, read: true })));
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const selectedUserRef = useRef<User | null>(null);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  // Fetch users + unread
  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      const [usersRes, unreadRes] = await Promise.all([
        api.get('/users'),
        api.get('/chat/unread'),
      ]);
      setUsers(usersRes.data);
      setUnreadCounts(unreadRes.data);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Load conversation
  useEffect(() => {
    if (!selectedUser) return;
    const load = async () => {
      const { data } = await api.get(`/chat/conversation/${selectedUser._id}`);
      setMessages(data);
      setUnreadCounts(prev => ({ ...prev, [selectedUser._id]: 0 }));
      if (socket) socket.emit('markRead', { senderId: selectedUser._id });
    };
    load();
  }, [selectedUser]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !selectedUser || !socket) return;
    socket.emit('sendMessage', { receiverId: selectedUser._id, content: input.trim() });
    setInput('');
    socket.emit('typing', { receiverId: selectedUser._id, isTyping: false });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!socket || !selectedUser) return;
    socket.emit('typing', { receiverId: selectedUser._id, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { receiverId: selectedUser._id, isTyping: false });
    }, 1500);
  };

  const handleAvatarUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarLoading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', f);
      const { data } = await api.patch('/users/avatar', fd);
      const updated = { ...currentUser, ...data };
      setCurrentUser(updated);
      setUser(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    router.push('/login');
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (d?: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const isTypingFromSelected = selectedUser && typingUsers.has(selectedUser._id);

  if (!currentUser) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse, rgba(124,106,247,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* SIDEBAR */}
      <div style={{
        width: 320, minWidth: 280, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, #7c6af7, #f767a0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>✦</div>
              <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>Echo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isConnected ? 'var(--green)' : 'var(--text-muted)',
                boxShadow: isConnected ? '0 0 6px var(--green)' : 'none',
              }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Current user profile */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--bg-card)', borderRadius: 12, cursor: 'pointer',
              border: '1px solid var(--border)', transition: 'all 0.2s',
            }}
            onClick={() => setShowProfile(true)}
          >
            <Avatar name={currentUser.name} src={currentUser.avatar} size={38} isOnline={true} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'Syne', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>My account</div>
            </div>
            <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>⚙</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 16px' }}>
          <input
            className="input-field"
            placeholder="🔍  Search people..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 13, padding: '9px 14px' }}
          />
        </div>

        {/* Users list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>
            People — {filteredUsers.length}
          </div>
          {filteredUsers.map(user => {
            const isSelected = selectedUser?._id === user._id;
            const unread = unreadCounts[user._id] || 0;
            return (
              <div
                key={user._id}
                onClick={() => setSelectedUser(user)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
                  borderRadius: 12, cursor: 'pointer', marginBottom: 2,
                  background: isSelected ? 'rgba(124,106,247,0.12)' : 'transparent',
                  border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Avatar name={user.name} src={user.avatar} size={42} isOnline={user.isOnline} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, fontFamily: 'Syne', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </span>
                    {unread > 0 && (
                      <span style={{
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                        color: 'white', fontSize: 11, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 10, minWidth: 20, textAlign: 'center',
                      }}>{unread > 9 ? '9+' : unread}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {user.isOnline ? (
                      <span style={{ color: 'var(--green)' }}>● Active now</span>
                    ) : user.lastSeen ? (
                      `Last seen ${formatLastSeen(user.lastSeen)}`
                    ) : 'Offline'}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              No users found
            </div>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
        {selectedUser ? (
          <>
            {/* Chat header */}
            <div style={{
              padding: '14px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--bg-secondary)',
            }}>
              <Avatar name={selectedUser.name} src={selectedUser.avatar} size={42} isOnline={selectedUser.isOnline} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>{selectedUser.name}</div>
                <div style={{ fontSize: 12, color: selectedUser.isOnline ? 'var(--green)' : 'var(--text-muted)' }}>
                  {isTypingFromSelected ? (
                    <span style={{ color: 'var(--accent-light)' }}>typing…</span>
                  ) : selectedUser.isOnline ? 'Active now' : selectedUser.lastSeen ? `Last seen ${formatLastSeen(selectedUser.lastSeen)}` : 'Offline'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
                  <div style={{ fontSize: 48 }}>💬</div>
                  <p style={{ fontSize: 15 }}>No messages yet. Say hello!</p>
                </div>
              )}

              {messages.map((msg, i) => {
                // Skip malformed messages
                if (!msg || !msg.sender) return null;

                const isOwn = msg.sender._id === currentUser._id;
                const prevMsg = messages[i - 1];
                const showAvatar = !prevMsg || prevMsg.sender._id !== msg.sender._id;

                return (
                  <div
                    key={msg._id}
                    className="animate-pop"
                    style={{
                      display: 'flex', gap: 8,
                      flexDirection: isOwn ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      marginTop: showAvatar ? 12 : 2,
                    }}
                  >
                    {!isOwn && (
                      <div style={{ width: 28, flexShrink: 0 }}>
                        {showAvatar && <Avatar name={msg.sender.name} src={msg.sender.avatar} size={28} />}
                      </div>
                    )}
                    <div style={{ maxWidth: '65%' }}>
                      {!isOwn && showAvatar && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, marginLeft: 4 }}>
                          {msg.sender.name}
                        </div>
                      )}
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isOwn
                          ? 'linear-gradient(135deg, var(--accent) 0%, #9d60f7 100%)'
                          : 'var(--bg-card)',
                        border: isOwn ? 'none' : '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                        boxShadow: isOwn ? '0 4px 16px rgba(124,106,247,0.3)' : 'var(--shadow)',
                      }}>
                        {msg.content}
                      </div>
                      <div style={{
                        fontSize: 10, color: 'var(--text-muted)',
                        textAlign: isOwn ? 'right' : 'left',
                        marginTop: 3, paddingLeft: 4, paddingRight: 4,
                        display: 'flex', alignItems: 'center',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        gap: 3,
                      }}>
                        {formatTime(msg.createdAt)}
                        {isOwn && (
                          <span style={{ color: msg.read ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTypingFromSelected && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                  <Avatar name={selectedUser.name} src={selectedUser.avatar} size={28} />
                  <div style={{
                    padding: '10px 16px', borderRadius: '18px 18px 18px 4px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    display: 'flex', gap: 4, alignItems: 'center',
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                        animation: 'pulse 1.2s ease-in-out infinite',
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div style={{
              padding: '12px 20px 16px', borderTop: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <input
                className="input-field"
                placeholder={`Message ${selectedUser.name}…`}
                value={input}
                onChange={handleTyping}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                style={{ flex: 1, borderRadius: 24, padding: '11px 18px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: input.trim() ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, transition: 'all 0.2s', flexShrink: 0,
                  boxShadow: input.trim() ? '0 4px 16px var(--accent-glow)' : 'none',
                }}
              >
                ↑
              </button>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(124,106,247,0.15), rgba(247,103,160,0.15))',
              border: '1px solid var(--border-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}>✦</div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Welcome, {currentUser.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select someone on the left to start a conversation</p>
            </div>
          </div>
        )}
      </div>

      {/* PROFILE MODAL */}
      {showProfile && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, backdropFilter: 'blur(8px)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowProfile(false); }}
        >
          <div className="glass animate-pop" style={{ width: 360, borderRadius: 20, padding: 32, position: 'relative' }}>
            <button
              onClick={() => setShowProfile(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg-hover)', border: 'none', color: 'var(--text-secondary)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}
            >×</button>

            <h3 style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, marginBottom: 24 }}>My Profile</h3>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={currentUser.name} src={currentUser.avatar} size={88} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarLoading}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--bg-card)',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: 'white',
                  }}
                >
                  {avatarLoading ? '⟳' : '✏'}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpdate} />

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20 }}>{currentUser.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{currentUser.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ color: 'var(--green)', fontSize: 12 }}>●</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Currently online</span>
              </div>
              <button
                onClick={logout}
                style={{
                  width: '100%', padding: '11px', border: '1px solid rgba(255,92,122,0.3)',
                  background: 'rgba(255,92,122,0.08)', color: '#ff5c7a',
                  borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  transition: 'all 0.2s',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}