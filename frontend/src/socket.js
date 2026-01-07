import { io } from "socket.io-client";

export const socket = io("https://146562840101.ngrok-free.app", {
  transports: ["websocket"], // important
});
