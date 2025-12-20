import "./App.css";
import CreateRoom from "./pages/createRoom";
import Home from "./pages/home";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<CreateRoom />} />
      </Routes>
    </Router>
  )
}

export default App;
