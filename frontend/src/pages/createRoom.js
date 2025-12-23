import { useLocation, useNavigate } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { socket } from "../socket"
import { doc, getDoc, deleteDoc } from "firebase/firestore"
import { db } from "./../firebase"
import "./createRoom.css"
import "./home.css"

const CreateRoom = () => {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [videoId, setVideoId] = useState(null)
  const [currentUser, setcurrentUser] = useState("")
  const [isLeader, setisLeader] = useState(false)
  const [queue, setQueue] = useState([])
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const isSeekingRef = useRef(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [members, setMembers] = useState([])
  const [leader, setLeader] = useState("")
  const [leftUser, setleftUser] = useState(null)
  const [currentSong, setCurrentSong] = useState({ title: "", thumbnail: "" })
  const [queueInfo, setQueueInfo] = useState([])

  const timeIntervalRef = useRef(null)
  const playerRef = useRef(null)
  const loadedVideoRef = useRef(null)
  const syncAppliedRef = useRef(false)
  const hasJoinedRef = useRef(false) // Prevent double join

  const API_KEY = process.env.REACT_APP_YT_API_KEY
  function handlePlayerReady() {
    console.log("Player ready!")
    setPlayerReady(true)
  }

  // Validate state and redirect if invalid
  useEffect(() => {
    if (!state?.roomCode || !state?.name) {
      console.error("Invalid room state, redirecting to home");
      navigate("/");
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state?.roomCode) {
      document.title = `Song Syncer - Room: ${state.roomCode}`
    }
  }, [state?.roomCode])

  useEffect(() => {
    if (!videoId) return

    fetchVideoInfo(videoId).then((info) => {
      if (info) {
        setCurrentSong(info)
      }
    })
  }, [videoId])

  useEffect(() => {
    if (!queue.length) {
      setQueueInfo([])
      return
    }

    const nextSongs = queue.slice(1)

    Promise.all(nextSongs.map((id) => fetchVideoInfo(id))).then((results) => {
      setQueueInfo(results.filter(Boolean))
    })
  }, [queue])

  // Join room - only once
  useEffect(() => {
    if (!state?.roomCode || !state?.name || hasJoinedRef.current) return

    hasJoinedRef.current = true

    console.log("Joining room:", state.roomCode, "as", state.name)
    socket.emit("join_room", {
      roomCode: state.roomCode,
      name: state.name,
    })

    setcurrentUser(state.name)

    const run = async () => {
      const leader = await checkLeader(state.roomCode, state.name)
      setisLeader(leader)
    }

    run()

    // Cleanup on unmount
    return () => {
      hasJoinedRef.current = false
    }
  }, [state?.roomCode, state?.name])

  // Handle full queue sync for late joiners
  useEffect(() => {
    const handleFullQueueSync = (fullQueue) => {
      console.log("Received full queue sync:", fullQueue)
      setQueue(fullQueue)
    }

    socket.on("full_queue_sync", handleFullQueueSync)
    return () => socket.off("full_queue_sync", handleFullQueueSync)
  }, [])

  useEffect(() => {
    const handler = () => {
      navigate("/")
    }

    socket.on("disconnect_run", handler)

    return () => {
      socket.off("disconnect_run", handler)
    }
  }, [navigate])

  useEffect(() => {
    const handleLeaderUpdate = (newLeader) => {
      console.log("New leader:", newLeader)
      setLeader(newLeader)
      setisLeader(currentUser === newLeader)
    }

    socket.on("leader_update", handleLeaderUpdate)
    return () => socket.off("leader_update", handleLeaderUpdate)
  }, [currentUser])

  useEffect(() => {
    socket.on("member_left", (name) => {
      console.log("Member left:", name)
      setleftUser(name)
      setTimeout(() => setleftUser(null), 3000)
    })

    return () => socket.off("member_left")
  }, [])

  useEffect(() => {
    const handler = () => {
      const player = playerRef.current
      if (!player || !playerReady) return

      const playerState = player.getPlayerState()

      if (playerState === 1) {
        player.pauseVideo()
      } else {
        player.playVideo()
      }
    }

    socket.on("toggle_play", handler)
    return () => socket.off("toggle_play", handler)
  }, [playerReady])

  useEffect(() => {
    const handleShift = () => {
      setQueue((prev) => {
        const newQueue = prev.slice(1)
        syncAppliedRef.current = false
        return newQueue
      })
      loadedVideoRef.current = null
      setDuration(0)
      setCurrentTime(0)
    }

    socket.on("queue_shift", handleShift)
    return () => socket.off("queue_shift")
  }, [])

  useEffect(() => {
    const handleQueue = (data) => {
      console.log("Queue update:", data)
      setQueue((prev) => {
        if (!prev.includes(data.id)) {
          return [...prev, data.id]
        }
        return prev
      })
    }

    socket.on("queue_update", handleQueue)
    return () => socket.off("queue_update", handleQueue)
  }, [])

  // Load video when queue changes and player is ready
  useEffect(() => {
    if (!queue.length || !playerReady) return

    const current = queue[0]
    const player = playerRef.current
    if (!player) return

    if (loadedVideoRef.current !== current) {
      console.log("Loading new video:", current)
      loadedVideoRef.current = current
      setVideoId(current)
      player.loadVideoById(current)
      player.playVideo()
      syncAppliedRef.current = false
    }
  }, [queue, playerReady])

  // Handle sync from leader
  useEffect(() => {
    const handleSync = (sync) => {
      const player = playerRef.current
      if (!player || !playerReady) {
        console.log("Player not ready for sync")
        return
      }

      // If video changed, load it
      if (sync.video && loadedVideoRef.current !== sync.video) {
        console.log("Sync: Loading video", sync.video)
        loadedVideoRef.current = sync.video
        setVideoId(sync.video)
        player.loadVideoById(sync.video)
        syncAppliedRef.current = false
        return
      }

      // Only sync time if we have the same video loaded
      if (sync.video === loadedVideoRef.current) {
        const delay = (Date.now() - sync.timestamp) / 1000
        const targetTime = sync.currentTime + delay
        const currentPlayerTime = player.getCurrentTime()

        // Only seek if difference is significant
        if (Math.abs(currentPlayerTime - targetTime) > 0.5) {
          console.log("Syncing time:", targetTime)
          player.seekTo(targetTime, true)
        }

        // Sync play state
        const currentState = player.getPlayerState()
        if (sync.isPlaying && currentState !== 1) {
          player.playVideo()
        } else if (!sync.isPlaying && currentState === 1) {
          player.pauseVideo()
        }

        syncAppliedRef.current = true
      }
    }

    socket.on("sync_tick", handleSync)

    return () => {
      socket.off("sync_tick", handleSync)
    }
  }, [playerReady])

  // Leader broadcasts state
  useEffect(() => {
    if (!isLeader || !playerRef.current || !videoId) return

    const interval = setInterval(() => {
      const player = playerRef.current
      if (!player) return

      const currentState = player.getPlayerState()
      
      socket.emit("sync_data", {
        roomCode: state.roomCode,
        video: videoId,
        currentTime: player.getCurrentTime(),
        isPlaying: currentState === window.YT.PlayerState.PLAYING,
        playbackRate: player.getPlaybackRate(),
        timestamp: Date.now(),
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isLeader, videoId, state.roomCode])

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      window.onYouTubeIframeAPIReady = loadPlayer
      document.body.appendChild(tag)
    } else {
      loadPlayer()
    }

    // Cleanup
    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const fetchLeader = async () => {
      const leaderName = await getLeader(state.roomCode)
      setLeader(leaderName)
    }
    if (state?.roomCode) {
      fetchLeader()
    }
  }, [state?.roomCode])

  useEffect(() => {
    const handleMembers = (membersList) => {
      setMembers(membersList)
    }

    socket.on("members_update", handleMembers)

    return () => {
      socket.off("members_update", handleMembers)
    }
  }, [])

  async function checkLeader(code, user) {
    try {
      const docRef = doc(db, "rooms", String(code))
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) return false

      return user === docSnap.data().leader
    } catch (err) {
      console.error("Error checking leader:", err)
      return false
    }
  }

  async function deleteRoom() {
    try {
      const roomRef = doc(db, "rooms", String(state.roomCode))
      await deleteDoc(roomRef)
      console.log("Room deleted")
      socket.emit("end_room", state.roomCode)
      navigate("/")
    } catch (err) {
      console.error("Failed to delete room:", err)
      alert("Failed to delete room")
    }
  }

  async function getLeader(code) {
    try {
      const docRef = doc(db, "rooms", String(code))
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) return ""
      return docSnap.data().leader || ""
    } catch (err) {
      console.error("Error getting leader:", err)
      return ""
    }
  }

  const handlePlayerDuration = (event) => {
    const duration = event.target.getDuration()
    setDuration(duration)
  }

  const onPlayerStateChange = (e) => {
    console.log(e.data);
    if (e.data === 1 && duration === 0) {
      handlePlayerDuration(e)
    }

    if (e.data === 1 || e.data === 3) { 
      if (!timeIntervalRef.current) {
        timeIntervalRef.current = setInterval(() => {
          if (!isSeekingRef.current && playerRef.current) {
            setCurrentTime(playerRef.current.getCurrentTime())
          }
        }, 300)
      }
    }

    if (e.data === 2 || e.data === 0 ||) { // Paused, Ended, or Cued
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current)
        timeIntervalRef.current = null
      }
    }

    if (e.data === 2) {
      setIsPlaying(false)
    }
    if (e.data === 1) {
      setIsPlaying(true)
    }

    // When video ends, play next song
    if (e.data == 0 && isLeader) {
      console.log("Video ended, moving to next song")
      socket.emit("next_song", state.roomCode)
    }
  }

  const nextButton = () => {
    socket.emit("next_song", state.roomCode)
  }

  const togglePlayPause = () => {
    if (!playerRef.current) return
    socket.emit("toggle_play", state.roomCode)
  }

  async function fetchVideoInfo(videoId) {
    if (!videoId) return null
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`,
      )
      const data = await response.json()
      if (data.items && data.items.length > 0) {
        const snippet = data.items[0].snippet
        return {
          title: snippet.title,
          thumbnail: snippet.thumbnails.high.url,
        }
      }
      return null
    } catch (err) {
      console.error("Error fetching video info:", err)
      return null
    }
  }

  const loadPlayer = () => {
    if (playerRef.current) return

    playerRef.current = new window.YT.Player("yt-player", {
      height: "1",
      width: "1",
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onReady: handlePlayerReady,
        onStateChange: onPlayerStateChange,
      },
    })
  }

  const searchVideo = async () => {
    if (!query.trim()) return

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(
        query,
      )}&key=${API_KEY}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.items && data.items.length > 0) {
        setResults(data.items)
      } else {
        setResults([])
        alert("No results found")
      }
    } catch (err) {
      console.error("Error searching videos:", err)
      alert("Failed to search videos")
    }
  }

  const chooseVideo = (id) => {
    socket.emit("add_to_queue", { code: state.roomCode, id: id })
    setResults([])
    setQuery("")
  }

  return (
    <div className="create-main">
      <div className="bg-animation">
        <div id="stars"></div>
        <div id="stars2"></div>
        <div id="stars3"></div>
        <div id="stars4"></div>
      </div>

      <h1>Room Code: {state?.roomCode || "Loading..."}</h1>

      {leftUser && <p className="leave-message">🚪 {leftUser} left the room</p>}
      <div className="room-container">
        <div className="search-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Enter song name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchVideo()}
            />
            <button onClick={searchVideo} className="btn btn-primary">
              🔍 Search
            </button>
          </div>

          {results.length > 0 && (
            <div className="results-container">
              <h3>Select a video:</h3>
              <ul className="results-list">
                {results.map((item) => (
                  <li key={item.id.videoId} onClick={() => chooseVideo(item.id.videoId)} className="result-item">
                    <img src={item.snippet.thumbnails.default.url || "/placeholder.svg"} alt="" />
                    <span>{item.snippet.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="player-section">
          {videoId && currentSong.thumbnail && (
            <div className="current-song-display">
              <img
                src={currentSong.thumbnail || "/placeholder.svg"}
                alt={currentSong.title}
                className="song-thumbnail"
              />
              <h2 className="song-title">{currentSong.title}</h2>
            </div>
          )}

          <div className="player-wrapper">
            <div id="yt-player"></div>
          </div>

          <div className="slider-container">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step="0.1"
              value={currentTime}
              className="custom-slider"
              style={{
                "--progress": `${duration ? (currentTime / duration) * 100 : 0}%`,
              }}
              onMouseDown={() => (isSeekingRef.current = true)}
              onTouchStart={() => (isSeekingRef.current = true)}
              onMouseUp={(e) => {
                isSeekingRef.current = false
                const seekTime = Number(e.target.value)
                playerRef.current?.seekTo(seekTime, true)

                if (isLeader) {
                  socket.emit("sync_data", {
                    roomCode: state.roomCode,
                    video: videoId,
                    currentTime: seekTime,
                    isPlaying: true,
                    timestamp: Date.now(),
                  })
                }
              }}
              onTouchEnd={(e) => {
                isSeekingRef.current = false
                const seekTime = Number(e.target.value)
                playerRef.current?.seekTo(seekTime, true)

                if (isLeader) {
                  socket.emit("sync_data", {
                    roomCode: state.roomCode,
                    video: videoId,
                    currentTime: seekTime,
                    isPlaying: true,
                    timestamp: Date.now(),
                  })
                }
              }}
              onChange={(e) => setCurrentTime(Number(e.target.value))}
              disabled={!videoId}
            />
            <p className="time-display">
              {Math.floor(currentTime / 60)}:
              {Math.floor(currentTime % 60)
                .toString()
                .padStart(2, "0")}
              {" / "}
              {Math.floor(duration / 60)}:
              {Math.floor(duration % 60)
                .toString()
                .padStart(2, "0")}
            </p>
          </div>

          {isLeader && (
            <div className="controls">
              <button
                onClick={togglePlayPause}
                className="btn btn-primary btn-icon"
                aria-label={isPlaying ? "Pause" : "Play"}
                disabled={!videoId}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button 
                onClick={nextButton} 
                className="btn btn-secondary"
                disabled={queue.length <= 1}
              >
                ⏭ Next Song
              </button>
            </div>
          )}
        </div>

        {queueInfo.length > 0 && (
          <div className="queue-section">
            <h3>Queue ({queueInfo.length})</h3>
            <ul className="queue-list">
              {queueInfo.map((item, index) => (
                <li key={`${item.title}-${index}`} className="queue-item">
                  {index === 0 ? "🎵 Next Song: " : `${index + 1}. `}
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLeader && (
          <div className="delete-room-container" style={{ marginTop: "24px", textAlign: "center" }}>
            <button onClick={deleteRoom} className="btn btn-danger">
              🗑 Delete Room
            </button>
          </div>
        )}

        {members.length > 0 && (
          <div className="members-section">
            <h3>
              <i className="fa fa-users"></i> Room Members ({members.length})
            </h3>
            <ul className="members-list">
              {members.map((member, index) => (
                <li
                  key={`${member}-${index}`}
                  className={`member-item ${member === currentUser ? "current-user" : ""}`}
                >
                  <div className="member-avatar">
                    <i className="fa fa-user"></i>
                  </div>
                  <span className="member-name">{member}</span>
                  {member === leader && <span className="leader-badge">👑 Leader</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateRoom
