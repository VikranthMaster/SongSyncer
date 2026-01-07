import { io } from "socket.io-client";

export const socket = io("https://bd93d8fc87d5.ngrok-free.app", {
  transports: ["websocket"], // important
});
