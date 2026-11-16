import { NavLink, Outlet } from 'react-router-dom';
import {
  CheckSquare,
  LayoutGrid,
  Monitor,
  Moon,
  PlusCircle,
  Sun,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTheme } from '../../hooks/useAppHooks.js';
import { SegmentedControl } from '../ui/Primitives.jsx';
import styles from './AppShell.module.css';

const PRIMARY_NAV = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/employees', label: 'Employees', icon: Users, end: false },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, end: false },
];

const QUICK_NAV = [
  { to: '/tasks/new', label: 'Assign Task', icon: PlusCircle },
  { to: '/employees/new', label: 'Add Employee', icon: UserPlus },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

export function AppShell() {
  const { mode, setMode } = useTheme();

  const cycleMobileTheme = () => {
    const order = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
  };

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Workspace navigation">
        <div>
          <div className={styles.brandBlock}>
            <div className={styles.brandMark}>R</div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Roots Workspace</span>
              <span className={styles.brandSub}>People &amp; Operations</span>
            </div>
          </div>

          <div className={styles.navGroupLabel}>Workspace</div>
          <nav className={styles.navList}>
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.label}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()
                  }
                >
                  <Icon size={18} strokeWidth={1.85} />
                  <span className={styles.navLabel}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className={styles.navGroupLabel}>Quick Create</div>
          <nav className={styles.navList}>
            {QUICK_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  title={item.label}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()
                  }
                >
                  <Icon size={18} strokeWidth={1.85} />
                  <span className={styles.navLabel}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <span className={styles.themeLabel}>Appearance</span>
          <SegmentedControl
            ariaLabel="Appearance theme"
            options={THEME_OPTIONS}
            value={mode}
            onChange={setMode}
          />
        </div>
      </aside>

      <div className={styles.mainArea}>
        <div className={styles.mobileTopBar}>
          <div className={styles.brandBlock}>
            <div className={styles.brandMark}>R</div>
            <div className={styles.brandText}>
              <span className={styles.brandName}>Roots Workspace</span>
            </div>
          </div>
          <button
            type="button"
            onClick={cycleMobileTheme}
            className={styles.mobileThemeBtn}
            aria-label="Toggle appearance theme"
          >
            <ThemeIcon size={14} />
            <span>{mode === 'system' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>

        <main className={styles.mainContainer}>
          <Outlet />
        </main>
      </div>

      <nav className={styles.mobileTabBar} aria-label="Mobile navigation">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `${styles.mobileTabItem} ${isActive ? styles.mobileTabItemActive : ''}`.trim()
              }
            >
              <Icon size={20} strokeWidth={1.85} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/tasks/new"
          className={({ isActive }) =>
            `${styles.mobileTabItem} ${isActive ? styles.mobileTabItemActive : ''}`.trim()
          }
        >
          <PlusCircle size={20} strokeWidth={1.85} />
          <span>Assign</span>
        </NavLink>
      </nav>
    </div>
  );
}
