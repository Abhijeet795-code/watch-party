# Watch Party

Watch YouTube videos in sync with other people. One person hosts a room, others
join with a 6-character code, and playback (play/pause/seek/change video) stays
synchronized for everyone over WebSockets. The host can promote people to
moderator, remove them, or hand off the host role.

**Live URL:** _add your deployed link here after deploying_

## Stack

| Layer    | Technology                     |
|----------|---------------------------------|
| Frontend | React 18 + Vite, React Router   |
| Realtime | Socket.IO (client + server)     |
| Backend  | Node.js + Express                |
| Video    | YouTube IFrame Player API        |
| State    | In-memory (per server process)   |

No database is used — rooms live in memory on the backend process and are
cleared once empty.

## Project layout

```
watch-party/
├── backend/
│   ├── server.js              Express app + Socket.IO server bootstrap
│   ├── src/
│   │   ├── Participant.js     Participant class (id, name, role, permissions)
│   │   ├── Room.js            Room class (participants, playback state, chat)
│   │   ├── RoomManager.js     Creates/looks up rooms, generates room codes
│   │   └── socketHandlers.js  All socket.io event wiring + permission checks
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── socket.js                socket.io-client singleton
    │   ├── App.jsx                  Routes: "/" and "/room/:roomId"
    │   └── components/
    │       ├── Home.jsx             Create / join room form
    │       ├── RoomPage.jsx         Room screen: wires socket events to UI
    │       ├── VideoPlayer.jsx      YouTube IFrame API wrapper
    │       ├── ParticipantList.jsx  Roster + host controls
    │       └── Chat.jsx             Room chat
    └── .env.example
```

## Run it locally

Requires **Node.js 18+**. Two terminals: one for the backend, one for the frontend.

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env
npm install
npm run dev                # http://localhost:4000

# Terminal 2 — frontend
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Open `http://localhost:5173` in two tabs, create a room in one, join it with
the room code in the other, and press play — both should sync.

## Deploy it

The backend needs a platform that supports persistent WebSocket connections
(Render or Railway). Vercel/Netlify serverless functions do not support
long-lived WebSocket servers, so use those only for the frontend.

### Backend → Render (or Railway)
1. Push the repo to GitHub.
2. New Web Service → root directory `backend`, build `npm install`, start `npm start`.
3. Set env var `CLIENT_ORIGIN` to your frontend URL.

### Frontend → Vercel (or Netlify / Render static site)
1. New Project → root directory `frontend`, build `npm run build`, output `dist`.
2. Set env var `VITE_SERVER_URL` to your backend URL.
3. Update the backend's `CLIENT_ORIGIN` to the frontend URL and redeploy.

`frontend/vercel.json` and `frontend/public/_redirects` already handle SPA
rewrites so a direct link like `/room/ABC123` doesn't 404 on Vercel/Netlify.

## Architecture overview — how WebSockets fit in

1. The frontend opens a single Socket.IO connection (`src/socket.js`) on load.
2. `create_room` / `join_room` use an acknowledgement callback so the client
   gets `{ ok, roomId, userId, role, state, participants }` immediately. The
   server puts the socket into a Socket.IO room (`socket.join(roomId)`) so
   `io.to(roomId).emit(...)` reaches only that party.
3. Playback events (`play`, `pause`, `seek`, `change_video`) update the room's
   authoritative state on the server, which re-broadcasts one `sync_state`
   event to everyone. `VideoPlayer.jsx` snaps the real YouTube player to that
   state whenever it changes.
4. Presence and roles (`user_joined`, `user_left`, `role_assigned`,
   `participant_removed`) are broadcast on every roster change, each carrying
   the full participant list.
5. Chat reuses the same pattern: `chat_message` in, `chat_message` out, plus
   `chat_history` sent to a newly joined socket.

## How role-based access control works

- Each participant is a `Participant` instance (`backend/src/Participant.js`)
  with role `host`, `moderator`, or `participant`, and helper methods
  (`canControlPlayback()`, `canManageRoom()`).
- The server enforces permissions, not the UI: every mutating socket handler
  in `socketHandlers.js` checks the caller's permission before acting.
  - `play` / `pause` / `seek` / `change_video` require `canControlPlayback()`.
  - `assign_role` / `remove_participant` / `transfer_host` require `canManageRoom()`.
- The client also hides/disables controls based on role, purely as a UX nicety.
- If the host disconnects, `Room.promoteNextHost()` hands the role to the
  longest-standing remaining participant.
- Room codes are 6-character, ambiguity-free (`RoomManager.js` excludes
  `0/O/1/I`), generated with `nanoid`.

## Trade-offs / known limitations

- No persistence — rooms and chat live only in server memory.
- No authentication — usernames are self-reported.
- A dropped/reconnected socket rejoins as a new participant, losing its role.
- Single server instance — no cross-instance broadcast yet.

## Scaling further (not implemented)

- Persist rooms/roles in a database (Postgres/SQLite/MongoDB).
- Run multiple backend instances behind a load balancer with the
  [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/).
- Split `viewer` out as its own role alongside `participant`.

## Code walkthrough checklist

- `backend/src/Participant.js`, `Room.js`, `RoomManager.js` — OOP core: each
  class owns one responsibility.
- `backend/src/socketHandlers.js` — every event, and the permission guards at
  the top of each mutating handler.
- `frontend/src/components/VideoPlayer.jsx` — reconciling YouTube's player
  events with server-driven state.
- `frontend/src/components/RoomPage.jsx` — subscribes to all server events
  and turns them into React state.
