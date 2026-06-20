import { io } from "socket.io-client";

export const socket = io("https://leading-engineering-cells-experience.trycloudflare.com", {
  transports: ["websocket"],
});
