import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { DialogHost, ToastHost } from "./components/ui/feedback";

/** 应用外壳：自绘标题栏 + 侧栏导航 + 路由内容区。 */
export default function App() {
  return (
    <div className="app-shell">
      <TitleBar />
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastHost />
      <DialogHost />
    </div>
  );
}
