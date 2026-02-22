import { io } from "socket.io-client";

export const socket = io("https://c07c-117-206-233-245.ngrok-free.app", {
  transports: ["websocket"],
});
