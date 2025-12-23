import { io } from "socket.io-client";

export const socket = io("https://93c0ca76e5e2.ngrok-free.app", {
  transports: ["websocket"], // important
});
