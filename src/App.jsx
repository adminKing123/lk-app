import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StartPage        from "./pages/StartPage";
import ConversationPage from "./pages/ConversationPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing screen — generates token and navigates to conversation */}
        <Route path="/" element={<StartPage />} />

        {/* Conversation screen — avatar video + mic + transcript */}
        <Route path="/conversation" element={<ConversationPage />} />

        {/* Redirect everything else to the start screen */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

