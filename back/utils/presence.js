// Maps & helpers multi-socket par user
function buildPresence() {
  const socketsByUserMulti = new Map(); // username -> Set(socketId)
  const usersBySocket = new Map();      // socketId -> username

  function addPresence(username, socketId) {
    usersBySocket.set(socketId, username);
    let set = socketsByUserMulti.get(username);
    if (!set) { set = new Set(); socketsByUserMulti.set(username, set); }
    set.add(socketId);
  }
  function removePresence(socketId) {
    const username = usersBySocket.get(socketId);
    if (!username) return { username: null, stillOnline: false };
    usersBySocket.delete(socketId);
    const set = socketsByUserMulti.get(username);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        socketsByUserMulti.delete(username);
        return { username, stillOnline: false };
      }
    }
    return { username, stillOnline: true };
  }
  return { socketsByUserMulti, usersBySocket, addPresence, removePresence };
}

module.exports = { buildPresence };
