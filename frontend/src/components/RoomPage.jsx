import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket.js";
import VideoPlayer from "./VideoPlayer.jsx";
import ParticipantList from "./ParticipantList.jsx";
import Chat from "./Chat.jsx";

function extractVideoId(input) {
  let trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const pathMatch = url.pathname.match(/\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{11})/);
    if (pathMatch) return pathMatch[1];
  } catch {
    return null;
  }
  return null;
}

export default function RoomPage() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [username, setUsername] = useState(state?.username || "");
  const [selfId, setSelfId] = useState(state?.joinedAck?.userId || null);
  const [role, setRole] = useState(state?.joinedAck?.role || "participant");
  const [participants, setParticipants] = useState(state?.joinedAck?.participants || []);
  const [videoState, setVideoState] = useState(
    state?.joinedAck?.state || { videoId: null, playState: "paused", currentTime: 0 }
  );
  const [syncVersion, setSyncVersion] = useState(0);
  const [videoInput, setVideoInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const [joined, setJoined] = useState(Boolean(state?.joinedAck));
  const [nameInput, setNameInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const canControl = role === "host" || role === "moderator";
  const isHost = role === "host";

  function handleJoinViaLink(e) {
    e.preventDefault();
    setJoinError("");
    if (!nameInput.trim()) return setJoinError("Enter a name first.");
    setJoining(true);
    socket.emit("join_room", { roomId, username: nameInput.trim() }, (res) => {
      setJoining(false);
      if (!res?.ok) return setJoinError(res?.error || "Could not join room.");
      setUsername(nameInput.trim());
      setSelfId(res.userId);
      setRole(res.role);
      setParticipants(res.participants);
      setVideoState(res.state);
      setSyncVersion((v) => v + 1);
      setJoined(true);
    });
  }

  useEffect(() => {
    function onSyncState(payload) {
      const { participants: p, ...rest } = payload;
      setVideoState(rest);
      if (p) setParticipants(p);
      setSyncVersion((v) => v + 1);
    }
    function onUserJoined(payload) {
      setParticipants(payload.participants);
      setNotice(`${payload.username} joined`);
    }
    function onUserLeft(payload) {
      setParticipants(payload.participants);
      setNotice(`${payload.username} left`);
    }
    function onRoleAssigned(payload) {
      setParticipants(payload.participants);
      if (payload.userId === selfId) setRole(payload.role);
      setNotice(`${payload.username} is now ${payload.role}`);
    }
    function onParticipantRemoved(payload) {
      setParticipants(payload.participants);
    }
    function onYouWereRemoved() {
      alert("You were removed from the room by the host.");
      navigate("/", { replace: true });
    }
    function onMeetingEnded() {
      alert("The host ended this watch party.");
      navigate("/", { replace: true });
    }
    function onChatHistory(history) {
      setMessages(history);
    }
    function onChatMessage(message) {
      setMessages((m) => [...m, message]);
    }
    function onErrorMessage(payload) {
      setNotice(payload.message);
    }

    socket.on("sync_state", onSyncState);
    socket.on("user_joined", onUserJoined);
    socket.on("user_left", onUserLeft);
    socket.on("role_assigned", onRoleAssigned);
    socket.on("participant_removed", onParticipantRemoved);
    socket.on("you_were_removed", onYouWereRemoved);
    socket.on("meeting_ended", onMeetingEnded);
    socket.on("chat_history", onChatHistory);
    socket.on("chat_message", onChatMessage);
    socket.on("error_message", onErrorMessage);

    return () => {
      socket.off("sync_state", onSyncState);
      socket.off("user_joined", onUserJoined);
      socket.off("user_left", onUserLeft);
      socket.off("role_assigned", onRoleAssigned);
      socket.off("participant_removed", onParticipantRemoved);
      socket.off("you_were_removed", onYouWereRemoved);
      socket.off("meeting_ended", onMeetingEnded);
      socket.off("chat_history", onChatHistory);
      socket.off("chat_message", onChatMessage);
      socket.off("error_message", onErrorMessage);
    };
  }, [selfId, navigate]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (state?.joinedAck?.userId) setSelfId(state.joinedAck.userId);
  }, [state]);

  function handleChangeVideo(e) {
    e.preventDefault();
    const id = extractVideoId(videoInput);
    if (!id) return setNotice("That doesn't look like a valid YouTube link.");
    socket.emit("change_video", { videoId: id });
    setVideoInput("");
  }

  function handlePlay(currentTime) {
    socket.emit("play", { currentTime });
  }
  function handlePause(currentTime) {
    socket.emit("pause", { currentTime });
  }
  function handleSeek(time) {
    socket.emit("seek", { time });
  }
  function handleAssignRole(userId, newRole) {
    socket.emit("assign_role", { userId, role: newRole });
  }
  function handleRemove(userId) {
    socket.emit("remove_participant", { userId });
  }
  function handleTransferHost(userId) {
    socket.emit("transfer_host", { userId });
  }
  function handleSendChat(text) {
    socket.emit("chat_message", { text });
  }
  function handleLeave() {
    socket.emit("leave_room");
    navigate("/", { replace: true });
  }
  function handleEndMeeting() {
    if (!confirm("End this watch party for everyone? Chat history and the current video will be cleared.")) return;
    socket.emit("end_meeting");
  }
  function handleCopyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/room/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const roleLabel = useMemo(() => ({ host: "Host", moderator: "Moderator", participant: "Participant" }[role]), [role]);

  if (!joined) {
    return (
      <div className="screen screen--center">
        <div className="home-card">
          <p className="eyebrow">joining room</p>
          <h1 className="wordmark">{roomId}</h1>
          <p className="subhead">Enter your name to jump into this watch party.</p>
          <form onSubmit={handleJoinViaLink} className="form">
            <label className="field">
              <span>Your name</span>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Jordan"
                maxLength={24}
                autoFocus
              />
            </label>
            {joinError && <p className="error-text">{joinError}</p>}
            <button type="submit" className="btn btn--primary" disabled={joining}>
              {joining ? "Joining…" : "Join room"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="room-header">
        <div>
          <p className="eyebrow">room</p>
          <div className="room-code-row">
            <h1 className="room-code">{roomId}</h1>
            <button className="btn btn--ghost btn--small" onClick={handleCopyLink}>
              {copied ? "Copied!" : "Copy invite link"}
            </button>
          </div>
        </div>
        <div className="room-header__right">
          <span className={`role-pill role-pill--${role}`}>{roleLabel}</span>
          {isHost && (
            <button className="btn btn--ghost btn--small" onClick={handleEndMeeting}>
              End meeting for everyone
            </button>
          )}
          <button className="btn btn--ghost btn--small" onClick={handleLeave}>
            Leave
          </button>
        </div>
      </header>

      {notice && <div className="notice-bar">{notice}</div>}

      <main className="room-grid">
        <section className="room-grid__main">
          <VideoPlayer
            videoId={videoState.videoId}
            playState={videoState.playState}
            currentTime={videoState.currentTime}
            syncVersion={syncVersion}
            canControl={canControl}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
          />

          {canControl ? (
            <form className="video-input-row" onSubmit={handleChangeVideo}>
              <input
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="Paste a YouTube link to change the video…"
              />
              <button type="submit" className="btn btn--primary btn--small">
                Load
              </button>
            </form>
          ) : (
            <p className="fine-print fine-print--center">
              Only the host or a moderator can control playback. Ask them nicely.
            </p>
          )}
        </section>

        <aside className="room-grid__side">
          <ParticipantList
            participants={participants}
            selfId={selfId}
            isHost={isHost}
            onAssignRole={handleAssignRole}
            onRemove={handleRemove}
            onTransferHost={handleTransferHost}
          />
          <Chat messages={messages} selfId={selfId} onSend={handleSendChat} />
        </aside>
      </main>
    </div>
  );
}
