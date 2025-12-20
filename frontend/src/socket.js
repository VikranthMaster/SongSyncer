import { io } from "socket.io-client";

export const socket = io("https://d77f8f4379e5.ngrok-free.app", {
  transports: ["websocket"], // important
});
