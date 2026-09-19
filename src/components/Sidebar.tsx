import { NavLink } from "react-router-dom";
import packageInfo from "../../package.json";
import { BrainCircuit, ChartColumn, MessageSquareText, Package, Puzzle, Settings2 } from "lucide-react";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/usage", icon: ChartColumn, label: "用量统计", index: "01" },
  { to: "/models", icon: BrainCircuit, label: "模型管理", index: "02" },
  { to: "/sessions", icon: MessageSquareText, label: "对话管理", index: "03" },
  { to: "/packages", icon: Package, label: "插件管理", index: "04" },
  { to: "/skills", icon: Puzzle, label: "Skill 管理", index: "05" },
  { to: "/settings", icon: Settings2, label: "应用设置", index: "06" },
];

/** 侧栏：品牌区、导航区与底部状态条。 */
export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <BrainCircuit size={21} strokeWidth={1.8} />
        </div>
        <div className="brand-copy min-w-0">
          <strong className="block overflow-hidden text-control font-[650] tracking-[-0.01em] text-ellipsis whitespace-nowrap text-ink">
            Pi Switch
          </strong>
          <small className="mt-[3px] block text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            Control Center
          </small>
        </div>
      </div>

      <div className="nav-label">工作台</div>
      <nav className="nav-menu flex flex-col px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn("nav-item", isActive && "nav-item--active")}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
            <span className="nav-index">{item.index}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" />
        <span>LOCAL / READY</span>
        <span className="ml-auto tabular-nums">v{packageInfo.version}</span>
      </div>
    </aside>
  );
}
