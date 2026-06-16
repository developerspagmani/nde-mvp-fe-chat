import { useEffect, useState, useRef } from 'react';
import { LoroDoc } from 'loro-crdt';
import localforage from 'localforage';

export interface Message {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  parentId: string | null;
  pinned: boolean;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  reactions?: Record<string, number[]>;
}

export interface UserPresence {
  userId: number;
  status: 'online' | 'offline' | 'away';
}

export interface TypingIndicator {
  roomId: number;
  userId: number;
  isTyping: boolean;
}

// Convert Uint8Array to base64 in browser
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert base64 to Uint8Array in browser
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryStr = window.atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

export function useChatSync(
  roomId: number | null,
  token: string | null,
  currentUser: { id: number; displayName: string } | null,
  onUnreadCountUpdate?: (roomId: number) => void,
  onNewRoom?: (room: any) => void,
  onRoomMembersUpdated?: (roomId: number) => void,
  onRemovedFromRoom?: (roomId: number) => void,
  onRoomUpdated?: (roomId: number, name: string) => void
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // Per-room typing state: { roomId: { userId: isTyping } }
  const [typingUsers, setTypingUsers] = useState<Record<number, Record<number, boolean>>>({}); 
  const [userPresence, setUserPresence] = useState<Record<number, 'online' | 'offline' | 'away'>>({});
  const [readReceipts, setReadReceipts] = useState<Record<number, string>>({}); // userId -> lastReadMessageId

  const docRef = useRef<LoroDoc | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isSyncingLocalRef = useRef<boolean>(false); // prevent infinite loop on local updates

  // IndexedDB Storage setup via localforage
  useEffect(() => {
    localforage.config({
      name: 'google_chat_crdt',
      storeName: 'room_states',
    });
  }, []);

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ----------------------------------------------------
  // CRDT DOCUMENT & WEBSOCKET LIFECYCLE
  // ----------------------------------------------------
  useEffect(() => {
    if (!token || !currentUser) {
      setMessages([]);
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: number;
    let isCleanedUp = false;

    let unsubscribe: (() => void) | undefined;
    let unsubscribeLocal: (() => void) | undefined;

    const cacheKey = roomId ? `user_${currentUser.id}_room_${roomId}` : '';
    const offlineQueueKey = roomId ? `user_${currentUser.id}_offline_queue_${roomId}` : '';

    if (roomId) {
      // 1. Initialize Loro document for this room
      const doc = new LoroDoc();
      docRef.current = doc;

      // Load from local IndexedDB first (Offline cache)
      localforage.getItem<string>(cacheKey).then(async (cachedBase64) => {
        if (cachedBase64 && docRef.current === doc && !isCleanedUp) {
          try {
            isSyncingLocalRef.current = true;
            doc.import(base64ToUint8Array(cachedBase64));
          } catch (err) {
            console.error('Failed to import cached Loro state:', err);
          } finally {
            isSyncingLocalRef.current = false;
          }
          
          const list = doc.getList("messages");
          setMessages(list.toJSON() as Message[]);
        }
      });

      // Subscribe to Loro changes
      unsubscribe = doc.subscribe(() => {
        if (isCleanedUp) return;
        const list = doc.getList("messages");
        setMessages(list.toJSON() as Message[]);
      });

      // Subscribe to local updates to sync to WebSocket
      unsubscribeLocal = doc.subscribeLocalUpdates(async (updateBytes) => {
        if (isCleanedUp) return;
        // Avoid uploading updates if we are importing remote changes
        if (isSyncingLocalRef.current) return;

        const base64Update = uint8ArrayToBase64(updateBytes);

        // Save complete snapshot to IndexedDB locally
        const snapshot = doc.export({ mode: 'snapshot' });
        localforage.setItem(cacheKey, uint8ArrayToBase64(snapshot));

        // Send update over WebSocket if online
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'sync_update',
            data: { roomId, update: base64Update }
          }));
        } else {
          // Queue local update to run when online
          const queue = await localforage.getItem<string[]>(offlineQueueKey) || [];
          queue.push(base64Update);
          await localforage.setItem(offlineQueueKey, queue);
        }
      });

      // 2. Fetch remote DB snapshot to align state initially
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/rooms/${roomId}/crdt`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (res.ok) {
            const ab = await res.arrayBuffer();
            const bytes = new Uint8Array(ab);
            if (bytes.length > 0 && docRef.current === doc && !isCleanedUp) {
              try {
                isSyncingLocalRef.current = true;
                doc.import(bytes);
              } catch (err) {
                console.error('Failed to import fetched Loro state:', err);
              } finally {
                isSyncingLocalRef.current = false;
              }

              // Update cache
              const snapshot = doc.export({ mode: 'snapshot' });
              localforage.setItem(cacheKey, uint8ArrayToBase64(snapshot));
              
              const list = doc.getList("messages");
              setMessages(list.toJSON() as Message[]);
            } else if (bytes.length === 0 && docRef.current === doc && !isCleanedUp) {
              // Server has no state. Clear local cache for this room to avoid conflicts
              localforage.removeItem(cacheKey);
              try {
                const list = doc.getList("messages");
                if (list.length > 0) {
                  isSyncingLocalRef.current = true;
                  list.delete(0, list.length);
                  doc.commit();
                }
              } catch (err) {
                console.error('Failed to clear local list:', err);
              } finally {
                isSyncingLocalRef.current = false;
              }
              setMessages([]);
            }
          }
        })
        .catch(err => {
          if (!isCleanedUp) {
            console.error('Failed to fetch initial Loro state:', err);
          }
        });

      // Fetch read receipts for this room
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/rooms/${roomId}/receipts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then((data: Array<{ userId: number; lastReadMessageId: string }>) => {
          if (isCleanedUp) return;
          const receipts: Record<number, string> = {};
          data.forEach(r => {
            receipts[r.userId] = r.lastReadMessageId;
          });
          setReadReceipts(receipts);
        })
        .catch(err => {
          if (!isCleanedUp) console.error(err);
        });
    } else {
      setMessages([]);
    }

    // 3. Establish WebSocket connection
    const connectWS = () => {
      if (isCleanedUp) return;
      
      const socketUrl = `${import.meta.env.VITE_WS_BASE_URL}/ws?token=${token}`;
      ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        if (isCleanedUp) {
          ws?.close();
          return;
        }
        console.log('WS connected. Active room:', roomId);
        
        if (roomId) {
          // Join room
          ws?.send(JSON.stringify({
            type: 'join_room',
            data: { roomId }
          }));

          // Flush offline queued updates if any
          const queue = await localforage.getItem<string[]>(offlineQueueKey) || [];
          if (queue.length > 0 && !isCleanedUp) {
            console.log(`Flushing ${queue.length} offline updates...`);
            for (const base64Update of queue) {
              if (isCleanedUp) break;
              ws?.send(JSON.stringify({
                type: 'sync_update',
                data: { roomId, update: base64Update }
              }));
            }
            await localforage.removeItem(offlineQueueKey);
          }
        }
      };

      ws.onmessage = (event) => {
        if (isCleanedUp) return;
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          if (type === 'sync_update' && data.roomId === roomId) {
            const updateBytes = base64ToUint8Array(data.update);
            if (docRef.current) {
              try {
                isSyncingLocalRef.current = true;
                docRef.current.import(updateBytes);
              } catch (err) {
                console.error('Failed to import sync_update from WS:', err);
              } finally {
                isSyncingLocalRef.current = false;
              }

              // Save to cache
              const snapshot = docRef.current.export({ mode: 'snapshot' });
              localforage.setItem(cacheKey, uint8ArrayToBase64(snapshot));
            }
          }

          else if (type === 'typing') {
            const tRoomId: number = data.roomId;
            setTypingUsers(prev => ({
              ...prev,
              [tRoomId]: {
                ...(prev[tRoomId] || {}),
                [data.userId]: data.isTyping
              }
            }));
          }

          else if (type === 'presence') {
            setUserPresence(prev => ({
              ...prev,
              [data.userId]: data.status
            }));
          }

          else if (type === 'read_receipt' && data.roomId === roomId) {
            setReadReceipts(prev => ({
              ...prev,
              [data.userId]: data.messageId
            }));
          }

          else if (type === 'pin_message' && data.roomId === roomId) {
            // Note: The Loro CRDT document is synchronized automatically via the 'sync_update' event.
            // No manual document manipulation is needed here.
          }

          else if (type === 'unread_count_update') {
            if (onUnreadCountUpdate) {
              onUnreadCountUpdate(data.roomId);
            }
          }

          else if (type === 'new_room') {
            if (onNewRoom) {
              onNewRoom(data);
            }
          }

          else if (type === 'room_members_updated') {
            if (onRoomMembersUpdated) {
              onRoomMembersUpdated(data.roomId);
            }
          }

          else if (type === 'removed_from_room') {
            if (onRemovedFromRoom) {
              onRemovedFromRoom(data.roomId);
            }
          }

          else if (type === 'room_updated') {
            if (onRoomUpdated) {
              onRoomUpdated(data.roomId, data.name);
            }
          }
        } catch (err) {
          console.error('WS client message parsing error:', err);
        }
      };

      ws.onclose = () => {
        if (isCleanedUp) return;
        console.log('WS connection closed. Reconnecting in 3s...');
        reconnectTimeout = window.setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      isCleanedUp = true;
      if (unsubscribe) unsubscribe();
      if (unsubscribeLocal) unsubscribeLocal();
      if (ws) {
        ws.close();
      }
      clearTimeout(reconnectTimeout);
      // Clear typing state for this room on unmount
      setTypingUsers(prev => {
        const next = { ...prev };
        if (roomId !== null) delete next[roomId];
        return next;
      });
    };
  }, [roomId, token, currentUser, isOnline]);

  // ----------------------------------------------------
  // INTERACTIVE ACTIONS
  // ----------------------------------------------------
  const sendMessage = (
    content: string,
    parentId: string | null = null,
    attachmentUrl: string | null = null,
    attachmentName: string | null = null
  ) => {
    if (!docRef.current || !currentUser) return;

    const list = docRef.current.getList("messages");
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newMessage: Message = {
      id: messageId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content,
      parentId,
      pinned: false,
      createdAt: new Date().toISOString(),
      attachmentUrl,
      attachmentName,
      reactions: {},
    };

    list.push(newMessage);
    // commit() flushes the pending transaction so subscribe/subscribeLocalUpdates fire
    docRef.current.commit();
    
    // Trigger read receipt locally and send to ws
    sendReadReceipt(messageId);
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    if (!docRef.current || !currentUser) return;

    const list = docRef.current.getList("messages");
    let found = false;
    for (let i = 0; i < list.length; i++) {
      const item = list.get(i) as any;
      if (item && item.id === messageId) {
        const currentReactions = item.reactions ? { ...item.reactions } : {};
        const userIds = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
        
        const index = userIds.indexOf(currentUser.id);
        if (index > -1) {
          // Remove reaction
          userIds.splice(index, 1);
        } else {
          // Add reaction
          userIds.push(currentUser.id);
        }

        if (userIds.length === 0) {
          delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = userIds;
        }

        const updated = { ...item, reactions: currentReactions };
        list.delete(i, 1);
        list.insert(i, updated);
        found = true;
        break;
      }
    }

    if (found) {
      docRef.current.commit();
    }
  };

  const togglePinMessage = (messageId: string, currentPinStatus: boolean) => {
    if (!docRef.current) return;

    const list = docRef.current.getList("messages");
    let found = false;
    for (let i = 0; i < list.length; i++) {
      const item = list.get(i) as any;
      if (item && item.id === messageId) {
        const updated = { ...item, pinned: !currentPinStatus };
        list.delete(i, 1);
        list.insert(i, updated);
        found = true;
        break;
      }
    }

    if (found) {
      docRef.current.commit();

      // Send separate pin message event to let the server update database table directly
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'pin_message',
          data: { roomId, messageId, pinned: !currentPinStatus }
        }));
      }
    }
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        data: { roomId, isTyping }
      }));
    }
  };

  const sendReadReceipt = (messageId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'read_receipt',
        data: { roomId, messageId }
      }));
    }
  };

  const sendPresenceStatus = (status: 'online' | 'offline' | 'away') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'presence',
        data: { status }
      }));
    }
  };

  return {
    messages,
    isOnline,
    typingUsers,
    userPresence,
    readReceipts,
    sendMessage,
    toggleReaction,
    togglePinMessage,
    sendTypingStatus,
    sendReadReceipt,
    sendPresenceStatus
  };
}
