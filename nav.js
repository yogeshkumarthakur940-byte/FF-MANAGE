// ============================================================
// FF HUB — shared navigation shell
// Injects the sidebar + mobile topbar into any page with
// <div id="app-shell"><main class="main" id="page-content">...</main></div>
// ============================================================

import { auth, onAuthStateChanged, isAdmin, getPlayerByUid, signOut } from "./db.js";

const NAV_ITEMS = [
  { href: "index.html", label: "Overview", icon: "◆", key: "overview" },
  { href: "schedule.html", label: "Schedule", icon: "▤", key: "schedule" },
  { href: "results.html", label: "Results", icon: "▥", key: "results" },
  { href: "prize-pool.html", label: "Prize pool", icon: "◈", key: "prize" },
  { href: "roster.html", label: "Roster", icon: "☰", key: "roster" },
];

function basePath() {
  // handles pages nested one level down (admin/, player/)
  const p = window.location.pathname;
  return (p.includes("/admin/") || p.includes("/player/")) ? "../" : "";
}

export function renderShell(activeKey) {
  const root = basePath();
  const shell = document.getElementById("app-shell");
  if (!shell) return;

  const navHtml = NAV_ITEMS.map(item => `
    <a href="${root}${item.href}" class="${item.key === activeKey ? 'active' : ''}">
      <span aria-hidden="true">${item.icon}</span> ${item.label}
    </a>
  `).join("");

  shell.insertAdjacentHTML("afterbegin", `
    <div class="topbar">
      <a href="${root}index.html" class="brand"><span class="mark">FF</span> HUB</a>
      <button class="menu-btn" id="menuBtn" aria-label="Open menu">☰</button>
    </div>
    <div class="sidebar-scrim" id="scrim"></div>
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <a href="${root}index.html">
          <span class="mark">FF</span><span class="name">HUB</span>
        </a>
        <span class="tag">tournament ops</span>
      </div>
      <nav>${navHtml}</nav>
      <div class="sidebar-foot" id="sidebarFoot">
        <a href="${root}login.html">Player / admin login →</a>
      </div>
    </aside>
  `);

  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const scrim = document.getElementById("scrim");
  menuBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    scrim.classList.toggle("show");
  });
  scrim?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    scrim.classList.remove("show");
  });

  // reflect login state in the sidebar footer
  onAuthStateChanged(auth, async (user) => {
    const foot = document.getElementById("sidebarFoot");
    if (!foot) return;
    if (!user) {
      foot.innerHTML = `<a href="${root}login.html">Player / admin login →</a>`;
      return;
    }
    const admin = await isAdmin(user.uid);
    if (admin) {
      foot.innerHTML = `
        <div class="small text-muted">Signed in as admin</div>
        <a href="${root}admin/dashboard.html">Admin panel →</a><br>
        <a href="#" id="navSignOut">Sign out</a>
      `;
    } else {
      const player = await getPlayerByUid(user.uid);
      foot.innerHTML = `
        <div class="small text-muted">${player ? "Hi, " + player.ign : "Signed in"}</div>
        <a href="${root}player/dashboard.html">My dashboard →</a><br>
        <a href="#" id="navSignOut">Sign out</a>
      `;
    }
    document.getElementById("navSignOut")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      window.location.href = `${root}index.html`;
    });
  });
}
