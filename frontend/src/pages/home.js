import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./home.css";
import { doc,getDoc, setDoc } from "firebase/firestore";
import { db } from "./../firebase";
import { socket } from "../socket";
const Home = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [userCode, setuserCode] = useState("");
  const [createRoomName, setcreateRoomName] = useState("");
  const [joinRoomName, setjoinRoomName] = useState("");

  function generateRandom() {
    return Math.ceil(Math.random() * 10000);
  }

  async function checkCode(code) {
    const docRef = doc(db, "rooms", String(code)); // get document reference
    const docSnap = await getDoc(docRef);         // get the document
    return docSnap.exists();                      // true if exists
  }

  async function checkName(code, Name) {
    const docRef = doc(db, "rooms", String(code));
    const docSnap = await getDoc(docRef);
    if (docSnap.data().members.includes(Name)) {
      return true;
    } else {
      return false;
    }
  }

  async function handleClick(Cname) {
    let code;
    let exists = true;

    while (exists) {
      code = generateRandom();
      setCode(code);
      exists = await checkCode(code) && await checkName(code, Cname);
      const roomRef = doc(db, "rooms", String(code));
      await setDoc(roomRef, {
        leader: Cname,
      });
    }
    socket.emit("join_room", {roomCode: code, name: Cname});

    navigate(`/room/${code}`, {
      state: { roomCode: code, name: createRoomName },
    });
    }
    
    async function joinClick(userCode, Jname) {
        let exists = await checkCode(userCode) && !await checkName(userCode, Jname);
      if (exists) {
        navigate(`/room/${userCode}`, {
          state: { roomCode: userCode, name: joinRoomName },
        })
        socket.emit("join_room",  {roomCode: Number(userCode), name: Jname});
        } else {
            alert("Not there");
        }
    }

  return (
    <div className="main">
      <div className="bg-animation">
        <div id="stars"></div>
        <div id="stars2"></div>
        <div id="stars3"></div>
        <div id="stars4"></div>
      <div className="heading">
        <h1>Welcome to SongSyncer</h1>
        <p>
          The only place where you can create a jam with your friends and listen to music together.
        </p>
      </div>
      <div className="create-room">
        <h1>Create a Room</h1>
        <input placeholder="Enter Name.." value={createRoomName} onChange={(event) => setcreateRoomName(event.target.value)}/>
        <button onClick={()=>{handleClick(createRoomName)}}>Create</button>
      </div>

      <div className="join">
        <h1>Have a Room code? Join Up</h1>
        <input placeholder="Enter Name.." value={joinRoomName} onChange={(event)=>setjoinRoomName(event.target.value)}/>
        <input
          placeholder="Enter Code.."
          value={userCode}
          onChange={(event) => setuserCode(event.target.value)}
        />
        <button
          onClick={()=>joinClick(userCode, joinRoomName)}
        >
          Join Room
        </button>
      </div>
      </div>
    </div>
  );
};

export default Home;
