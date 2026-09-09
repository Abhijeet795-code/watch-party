import { Routes, Route } from "react-router-dom";
import Home from "./components/Home.jsx";
import RoomPage from "./components/RoomPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  );
}
