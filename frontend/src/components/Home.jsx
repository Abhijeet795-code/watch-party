import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket.js";

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState("create");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim()) return setError("Enter a name first.");
    if (mode === "join" && !roomCode.trim()) return setError("Enter a room code.");

    setLoading(true);

    if (mode === "create") {
      socket.emit("create_room", { username }, (res) => {
        setLoading(false);
        if (!res?.ok) return setError(res?.error || "Could not create room.");
        navigate(`/room/${res.roomId}`, { state: { username, joinedAck: res } });
      });
    } else {
      socket.emit("join_room", { roomId: roomCode.trim().toUpperCase(), username }, (res) => {
        setLoading(false);
        if (!res?.ok) return setError(res?.error || "Could not join room.");
        navigate(`/room/${res.roomId}`, { state: { username, joinedAck: res } });
      });
    }
  }

  return (
    <div className="screen screen--center">
      <div className="reel-strip" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="home-card">
        <p className="eyebrow">synchronized viewing</p>
        <h1 className="wordmark">
          Watch<span className="wordmark-accent">Party</span>
        </h1>
        <p className="subhead">Press play together, no matter where you are.</p>

        <div className="tabs">
          <button
            type="button"
            className={mode === "create" ? "tab tab--active" : "tab"}
            onClick={() => setMode("create")}
          >
            Start a room
          </button>
          <button
            type="button"
            className={mode === "join" ? "tab tab--active" : "tab"}
            onClick={() => setMode("join")}
          >
            Join a room
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Your name</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Jordan"
              maxLength={24}
              autoFocus
            />
          </label>

          {mode === "join" && (
            <label className="field">
              <span>Room code</span>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7K4QXB"
                maxLength={6}
                className="mono-input"
              />
            </label>
          )}

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? "One moment…" : mode === "create" ? "Create room" : "Join room"}
          </button>
        </form>

        <p className="fine-print">
          The person who starts a room becomes its host and can hand out roles once others join.
        </p>
      </div>
    </div>
  );
}
