import { useEffect, useRef, useState } from "react";

export default function Chat({ messages, selfId, onSend }) {
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  return (
    <div className="panel panel--chat">
      <h2 className="panel__title">Chat</h2>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && <p className="chat-empty">No messages yet. Say hello.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.userId === selfId ? "chat-msg chat-msg--self" : "chat-msg"}>
            <span className="chat-msg__author">{m.username}</span>
            <span className="chat-msg__text">{m.text}</span>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a message…"
          maxLength={500}
        />
        <button type="submit" className="btn btn--small">
          Send
        </button>
      </form>
    </div>
  );
}
