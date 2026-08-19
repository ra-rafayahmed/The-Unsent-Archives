import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { reportError } from "./utils/reportError";

// Eager: the two routes a visitor is most likely to land on first, so the
// initial paint needs no extra round trip.
import HomePage from "./pages/Feed/HomePage";
import Login from "./pages/Auth/Login";

// Lazy: everything else is fetched when its route is first visited. This keeps
// heavy dependencies out of the entry bundle — recharts (Analytics) and the
// note editor together dominated it.
const Register = lazy(() => import("./pages/Auth/Register"));
const ForgotPassword = lazy(() => import("./pages/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/Auth/ResetPassword"));
const RecoverWithCode = lazy(() => import("./pages/Auth/RecoverWithCode"));
const ExplorePage = lazy(() => import("./pages/Explore/ExplorePage"));
const SingleNoteView = lazy(() => import("./pages/Post/SingleNoteView"));
const CreateNotePage = lazy(() => import("./pages/Editor/CreateNotePage"));
const UserProfile = lazy(() => import("./pages/Profile/UserProfile"));
const CollectionsBoard = lazy(() => import("./pages/Library/CollectionsBoard"));
const CollectionDetailPage = lazy(() => import("./pages/Library/CollectionDetailPage"));
const AnalyticsDashboard = lazy(() => import("./pages/Analytics/AnalyticsDashboard"));
const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"));

const RouteFallback = () => <div className="panel">Turning the page...</div>;

const reportRenderError = (error, info) => {
  // Funnel render crashes through the shared reporting seam: it always logs and,
  // when VITE_ERROR_ENDPOINT is configured, forwards a sanitised report.
  reportError(error, { source: "render", componentStack: info?.componentStack });
};

const App = () => {
  return (
    <ErrorBoundary onError={reportRenderError}>
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
    </ErrorBoundary>
  );
};

export default App;
