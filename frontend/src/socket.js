import { io } from "socket.io-client";

export const socket = io("https://e0e181578785.ngrok-free.app", {
  transports: ["websocket"], // important
});