import { Navigate, Route, Routes } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import RecoverWithCode from "./pages/Auth/RecoverWithCode";
import HomePage from "./pages/Feed/HomePage";
import ExplorePage from "./pages/Explore/ExplorePage";
import SingleNoteView from "./pages/Post/SingleNoteView";
import CreateNotePage from "./pages/Editor/CreateNotePage";
import UserProfile from "./pages/Profile/UserProfile";
import CollectionsBoard from "./pages/Library/CollectionsBoard";
import CollectionDetailPage from "./pages/Library/CollectionDetailPage";
import AnalyticsDashboard from "./pages/Analytics/AnalyticsDashboard";
import AdminDashboard from "./pages/Admin/AdminDashboard";

const reportRenderError = (error, info) => {
  // Kept deliberately simple: a render crash is worth a console record even in
  // production, where source maps make the component stack useful.
  console.error("Render error:", error, info?.componentStack);
};

const App = () => {
  return (
    <ErrorBoundary onError={reportRenderError}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/recover" element={<RecoverWithCode />} />

        <Route element={<RootLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/posts/:id" element={<SingleNoteView />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfile own />
              </ProtectedRoute>
            }
          />
          <Route path="/profile/:id" element={<UserProfile />} />

          <Route
            path="/write"
            element={
              <ProtectedRoute>
                <CreateNotePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/write/:id"
            element={
              <ProtectedRoute>
                <CreateNotePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <CollectionsBoard />
              </ProtectedRoute>
            }
          />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
