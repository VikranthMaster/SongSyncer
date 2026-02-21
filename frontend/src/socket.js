import { io } from "socket.io-client";

export const socket = io("https://1281-117-221-161-88.ngrok-free.app", {
  transports: ["websocket"], // important
});
