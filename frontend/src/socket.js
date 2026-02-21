import { io } from "socket.io-client";

export const socket = io("https://b2e5-117-221-161-88.ngrok-free.app", {
  transports: ["websocket"], // important
});
