import { io } from "socket.io-client";

export const socket = io("https://ff89c0d2367d.ngrok-free.app", {
  transports: ["websocket"], // important
});
