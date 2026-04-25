import { Navigate, Route, Routes } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import HomePage from "./pages/Feed/HomePage";
import ExplorePage from "./pages/Explore/ExplorePage";
import SingleNoteView from "./pages/Post/SingleNoteView";
import CreateNotePage from "./pages/Editor/CreateNotePage";
import UserProfile from "./pages/Profile/UserProfile";
import CollectionsBoard from "./pages/Library/CollectionsBoard";
import AnalyticsDashboard from "./pages/Analytics/AnalyticsDashboard";

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<RootLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/posts/:id" element={<SingleNoteView />} />
        <Route path="/profile" element={<ProtectedRoute><UserProfile own /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<UserProfile />} />

        <Route path="/write" element={<ProtectedRoute><CreateNotePage /></ProtectedRoute>} />
        <Route path="/write/:id" element={<ProtectedRoute><CreateNotePage /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><CollectionsBoard /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
