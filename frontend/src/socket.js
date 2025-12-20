import { io } from "socket.io-client";

export const socket = io("https://5effd4e4e414.ngrok-free.app", {
  transports: ["websocket"], // important
});