import { useEffect, useRef } from "react";

let apiPromise = null;
function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  });
  return apiPromise;
}

export default function VideoPlayer({
  videoId,
  playState,
  currentTime,
  syncVersion,
  canControl,
  onPlay,
  onPause,
  onSeek,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const suppressEventsRef = useRef(false);
  const seekTimeoutRef = useRef(null);
  const lastKnownTimeRef = useRef(null);
  const loadedVideoIdRef = useRef(null);
  const latestRef = useRef({ videoId, playState, currentTime });
  latestRef.current = { videoId, playState, currentTime };

  useEffect(() => {
    let cancelled = false;
    loadYouTubeAPI().then((YT) => {
      if (cancelled || !containerRef.current) return;

      const config = {
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            readyRef.current = true;
            const { videoId: vid, playState: ps, currentTime: ct } = latestRef.current;
            const player = playerRef.current;
            if (vid && player) {
              suppressEventsRef.current = true;
              loadedVideoIdRef.current = vid;
              player.cueVideoById({ videoId: vid, startSeconds: ct || 0 });
              const applyIntendedState = () => {
                if (ps === "playing") player.playVideo();
                else player.pauseVideo();
              };
              setTimeout(applyIntendedState, 600);
              setTimeout(() => (suppressEventsRef.current = false), 1200);
            }
          },
          onStateChange: handlePlayerStateChange,
        },
      };

      playerRef.current = new YT.Player(containerRef.current, config);
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!readyRef.current || !player) return;

    suppressEventsRef.current = true;

    if (videoId && videoId !== loadedVideoIdRef.current) {
      loadedVideoIdRef.current = videoId;
      lastKnownTimeRef.current = currentTime;
      player.cueVideoById({ videoId, startSeconds: currentTime || 0 });
      const applyIntendedState = () => {
        if (playState === "playing") player.playVideo();
        else player.pauseVideo();
      };
      const t = setTimeout(applyIntendedState, 600);
      const clearSuppress = setTimeout(() => (suppressEventsRef.current = false), 1200);
      return () => {
        clearTimeout(t);
        clearTimeout(clearSuppress);
      };
    }

    if (videoId) {
      const drift = Math.abs((player.getCurrentTime?.() ?? 0) - currentTime);
      if (drift > 1.5) player.seekTo(currentTime, true);
      if (playState === "playing") player.playVideo?.();
      else player.pauseVideo?.();
    }

    const t = setTimeout(() => (suppressEventsRef.current = false), 500);
    return () => clearTimeout(t);
  }, [syncVersion]);

  function handlePlayerStateChange(event) {
    if (!canControl || suppressEventsRef.current || !window.YT) return;
    const player = playerRef.current;
    if (!player) return;

    if (event.data === window.YT.PlayerState.PLAYING) {
      onPlay?.(player.getCurrentTime());
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      onPause?.(player.getCurrentTime());
    }
  }

  useEffect(() => {
    if (!canControl) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || suppressEventsRef.current || !readyRef.current) return;
      const t = player.getCurrentTime?.();
      if (typeof t !== "number") return;

      if (Math.abs(t - (lastKnownTimeRef.current ?? t)) > 2) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = setTimeout(() => onSeek?.(t), 250);
      }
      lastKnownTimeRef.current = t;
    }, 700);
    return () => clearInterval(interval);
  }, [canControl]);

  return (
    <div className="player-frame">
      <div ref={containerRef} className="player-frame__iframe" />
      {!videoId && (
        <div className="player-frame__empty">
          <p>No video queued yet.</p>
        </div>
      )}
      {!canControl && <div className="player-frame__lock" title="Only the host or a moderator can control playback" />}
    </div>
  );
}
