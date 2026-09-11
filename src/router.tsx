import { createHashRouter, Navigate } from "react-router-dom";
import App from "./App";
import ModelsView from "./views/ModelsView";
import PackagesView from "./views/PackagesView";
import SessionsView from "./views/SessionsView";
import SettingsView from "./views/SettingsView";
import SkillsView from "./views/SkillsView";
import UsageView from "./views/UsageView";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/usage" replace /> },
      { path: "usage", element: <UsageView /> },
      { path: "models", element: <ModelsView /> },
      { path: "sessions", element: <SessionsView /> },
      { path: "packages", element: <PackagesView /> },
      { path: "skills", element: <SkillsView /> },
      { path: "settings", element: <SettingsView /> },
    ],
  },
]);
