import { renderShell } from "./nav.js";
import {
  auth, dbase, onAuthStateChanged, isAdmin, createPlayerLogin,
  collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  fetchAll, uploadFile, fmtDate, fmtDateTime, fmtMoney, statusBadge, escapeHtml
} from "./db.js";

renderShell(null);

// ---------- access gate ----------

onAuthStateChanged(auth, async (user) => {
  const gate = document.getElementById("gate");
  if (!user) {
    gate.innerHTML = `<p>You need to <a href="../login.html">sign in</a> as an admin to see this page.</p>`;
    return;
  }
  const admin = await isAdmin(user.uid);
  if (!admin) {
    gate.innerHTML = `<p>This login doesn't have admin access. Add your UID to the <span class="mono">admins</span> collection in Firestore to enable it — see README.md.</p>
      <p class="small mono text-faint">Your UID: ${user.uid}</p>`;
    return;
  }
  gate.style.display = "none";
  document.getElementById("content").style.display = "block";
  initAdmin();
});

// ---------- tabs ----------

document.querySelectorAll(".tabbar button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbar button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ---------- shared state ----------

let cache = { matches: [], players: [], teams: [], results: [], payments: [] };

async function refreshAll() {
  const [matches, players, teams, results, payments] = await Promise.all([
    fetchAll("matches", "date").catch(() => []),
    fetchAll("players").catch(() => []),
    fetchAll("teams").catch(() => []),
    fetchAll("results", "createdAt", "desc").catch(() => []),
    fetchAll("payments", "createdAt", "desc").catch(() => []),
  ]);
  cache = { matches, players, teams, results, payments };
  renderMatches(); renderResults(); renderPlayers(); renderTeams(); renderPayments();
  populateSelects();
}

function populateSelects() {
  const teamSel = document.getElementById("pTeam");
  teamSel.innerHTML = `<option value="">Unassigned</option>` + cache.teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

  const matchSel = document.getElementById("rMatch");
  matchSel.innerHTML = `<option value="">Select a match…</option>` + cache.matches.map(m => `<option value="${m.id}">${escapeHtml(m.title)} — ${fmtDate(m.date)}</option>`).join("");

  const payPlayerSel = document.getElementById("payPlayer");
  payPlayerSel.innerHTML = `<option value="">Select a player…</option>` + cache.players.map(p => `<option value="${p.id}">${escapeHtml(p.ign)}</option>`).join("");

  const payMatchSel = document.getElementById("payMatch");
  payMatchSel.innerHTML = `<option value="">(optional)</option>` + cache.matches.map(m => `<option value="${m.id}">${escapeHtml(m.title)}</option>`).join("");
}

function initAdmin() {
  refreshAll();
  wireMatchForm();
  wireResultForm();
  wirePlayerForm();
  wireTeamForm();
  wirePaymentForm();
  wireLoginModal();
  wireImgModal();
  addPlacementRow(); // seed one row
  document.getElementById("addPlacementRow").addEventListener("click", () => addPlacementRow());
}

// ============================================================
// MATCHES
// ============================================================

function wireMatchForm() {
  document.getElementById("matchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      title: document.getElementById("mTitle").value.trim(),
      date: document.getElementById("mDate").value,
      mode: document.getElementById("mMode").value,
      map: document.getElementById("mMap").value.trim(),
      status: document.getElementById("mStatus").value,
      teams: document.getElementById("mTeams").value.trim(),
      roomId: document.getElementById("mRoomId").value.trim(),
      roomPass: document.getElementById("mRoomPass").value.trim(),
      stream: document.getElementById("mStream").value.trim(),
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(dbase, "matches"), data);
    e.target.reset();
    document.getElementById("mMode").value = "Squad";
    document.getElementById("mStatus").value = "upcoming";
    await refreshAll();
  });
}

function renderMatches() {
  const rows = document.getElementById("matchRows");
  rows.innerHTML = cache.matches.length ? cache.matches.map(m => `
    <tr>
      <td>${escapeHtml(m.title)}</td>
      <td class="mono small">${fmtDateTime(m.date)}</td>
      <td>${statusBadge(m.status || "upcoming")}</td>
      <td class="mono small">${escapeHtml(m.roomId || "—")}</td>
      <td><button class="btn btn-sm btn-danger" data-del-match="${m.id}">Delete</button></td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="empty"><p>No matches yet.</p></td></tr>`;

  rows.querySelectorAll("[data-del-match]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this match?")) return;
      await deleteDoc(doc(dbase, "matches", btn.dataset.delMatch));
      await refreshAll();
    });
  });
}

// ============================================================
// RESULTS
// ============================================================

let placementCount = 0;

function addPlacementRow() {
  placementCount++;
  const id = "pl" + placementCount;
  const wrap = document.getElementById("placementRows");
  const row = document.createElement("div");
  row.className = "field-row";
  row.dataset.rowId = id;
  row.style.marginBottom = "6px";
  row.innerHTML = `
    <div class="field" style="max-width:70px;"><input type="number" placeholder="Pos" class="pl-pos" min="1"></div>
    <div class="field"><input type="text" placeholder="Team name" class="pl-team"></div>
    <div class="field" style="max-width:90px;"><input type="number" placeholder="Kills" class="pl-kills" min="0"></div>
    <div class="field" style="max-width:110px;"><input type="number" placeholder="Prize" class="pl-prize" min="0"></div>
    <button type="button" class="btn btn-sm btn-ghost" data-remove-row>&times;</button>
  `;
  wrap.appendChild(row);
  row.querySelector("[data-remove-row]").addEventListener("click", () => row.remove());
}

function wireResultForm() {
  document.getElementById("resultForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const matchId = document.getElementById("rMatch").value;
    const match = cache.matches.find(m => m.id === matchId);

    const placements = Array.from(document.querySelectorAll("#placementRows .field-row")).map(row => ({
      position: Number(row.querySelector(".pl-pos").value) || null,
      teamName: row.querySelector(".pl-team").value.trim(),
      kills: Number(row.querySelector(".pl-kills").value) || 0,
      prize: Number(row.querySelector(".pl-prize").value) || 0,
    })).filter(p => p.teamName);

    let screenshotUrl = "";
    const file = document.getElementById("rScreenshot").files[0];
    if (file) {
      screenshotUrl = await uploadFile(`results/${Date.now()}_${file.name}`, file);
    }

    const winner = placements.find(p => p.position === 1);

    await addDoc(collection(dbase, "results"), {
      matchId,
      matchTitle: match ? match.title : "",
      date: match ? match.date : new Date().toISOString(),
      totalPrize: Number(document.getElementById("rTotalPrize").value) || 0,
      placements,
      winnerTeam: winner ? winner.teamName : "",
      notes: document.getElementById("rNotes").value.trim(),
      screenshotUrl,
      createdAt: serverTimestamp(),
    });

    // mark the match completed
    if (matchId) {
      try { await updateDoc(doc(dbase, "matches", matchId), { status: "completed" }); } catch (err) {}
    }

    e.target.reset();
    document.getElementById("placementRows").innerHTML = "";
    addPlacementRow();
    await refreshAll();
  });
}

function renderResults() {
  const wrap = document.getElementById("resultRows");
  wrap.innerHTML = cache.results.length ? cache.results.map(r => `
    <div class="row-item">
      <div class="rl-date">${fmtDate(r.date)}</div>
      <div class="rl-main">
        <div class="rl-title">${escapeHtml(r.matchTitle || "Result")}</div>
        <div class="rl-sub">${r.placements?.length || 0} placement(s) · ${fmtMoney(r.totalPrize)}</div>
      </div>
      <button class="btn btn-sm btn-danger" data-del-result="${r.id}">Delete</button>
    </div>
  `).join("") : `<div class="empty"><p>No results uploaded yet.</p></div>`;

  wrap.querySelectorAll("[data-del-result]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this result?")) return;
      await deleteDoc(doc(dbase, "results", btn.dataset.delResult));
      await refreshAll();
    });
  });
}

// ============================================================
// PLAYERS
// ============================================================

function wirePlayerForm() {
  document.getElementById("playerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await addDoc(collection(dbase, "players"), {
      ign: document.getElementById("pIgn").value.trim(),
      playerId: document.getElementById("pFfid").value.trim(),
      teamId: document.getElementById("pTeam").value || null,
      role: document.getElementById("pRole").value.trim(),
      contact: document.getElementById("pContact").value.trim(),
      joinedDate: document.getElementById("pJoined").value || null,
      uid: null,
      createdAt: serverTimestamp(),
    });
    e.target.reset();
    await refreshAll();
  });
}

function renderPlayers() {
  const wrap = document.getElementById("playerRows");
  const teamMap = Object.fromEntries(cache.teams.map(t => [t.id, t.name]));
  wrap.innerHTML = cache.players.length ? cache.players.map(p => `
    <div class="player-row">
      <div class="avatar">${escapeHtml((p.ign || "?").slice(0, 2).toUpperCase())}</div>
      <div>
        <div class="pr-name">${escapeHtml(p.ign)}</div>
        <div class="pr-sub">FF ID: ${escapeHtml(p.playerId || "—")} ${p.uid ? "· has login" : "· no login yet"}</div>
      </div>
      <span class="pr-team">${escapeHtml(teamMap[p.teamId] || "Unassigned")}</span>
      ${!p.uid ? `<button class="btn btn-sm" data-create-login="${p.id}" data-name="${escapeHtml(p.ign)}">Create login</button>` : ""}
      <button class="btn btn-sm btn-danger" data-del-player="${p.id}">Delete</button>
    </div>
  `).join("") : `<div class="empty"><p>No players yet.</p></div>`;

  wrap.querySelectorAll("[data-del-player]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this player?")) return;
      await deleteDoc(doc(dbase, "players", btn.dataset.delPlayer));
      await refreshAll();
    });
  });

  wrap.querySelectorAll("[data-create-login]").forEach(btn => {
    btn.addEventListener("click", () => openLoginModal(btn.dataset.createLogin, btn.dataset.name));
  });
}

// ---------- create-login modal ----------

let loginModalPlayerId = null;

function wireLoginModal() {
  document.getElementById("closeLoginModal").addEventListener("click", closeLoginModal);
  document.getElementById("cancelLoginModal").addEventListener("click", closeLoginModal);
  document.getElementById("confirmLoginModal").addEventListener("click", async () => {
    const email = document.getElementById("newLoginEmail").value.trim();
    const pass = document.getElementById("newLoginPass").value;
    const msg = document.getElementById("loginModalMsg");
    if (!email || pass.length < 6) {
      msg.textContent = "Enter a valid email and a password of at least 6 characters.";
      msg.className = "msg show err";
      return;
    }
    try {
      const uid = await createPlayerLogin(email, pass);
      await updateDoc(doc(dbase, "players", loginModalPlayerId), { uid, loginEmail: email });
      msg.textContent = "Login created. Share the email and password with the player.";
      msg.className = "msg show ok";
      await refreshAll();
      setTimeout(closeLoginModal, 1400);
    } catch (err) {
      console.error(err);
      msg.textContent = "Couldn't create the login — " + (err.message || "check the email isn't already used.");
      msg.className = "msg show err";
    }
  });
}

function openLoginModal(playerId, name) {
  loginModalPlayerId = playerId;
  document.getElementById("newLoginEmail").value = "";
  document.getElementById("newLoginPass").value = "";
  document.getElementById("loginModalMsg").className = "msg";
  document.getElementById("createLoginModal").classList.add("show");
}

function closeLoginModal() {
  document.getElementById("createLoginModal").classList.remove("show");
}

// ============================================================
// TEAMS
// ============================================================

function wireTeamForm() {
  document.getElementById("teamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await addDoc(collection(dbase, "teams"), {
      name: document.getElementById("tName").value.trim(),
      tag: document.getElementById("tTag").value.trim(),
      createdAt: serverTimestamp(),
    });
    e.target.reset();
    await refreshAll();
  });
}

function renderTeams() {
  const wrap = document.getElementById("teamRows");
  wrap.innerHTML = cache.teams.length ? cache.teams.map(t => {
    const count = cache.players.filter(p => p.teamId === t.id).length;
    return `
      <div class="row-item">
        <div class="rl-main">
          <div class="rl-title">${escapeHtml(t.name)} ${t.tag ? `<span class="mono text-faint small">[${escapeHtml(t.tag)}]</span>` : ""}</div>
          <div class="rl-sub">${count} player${count === 1 ? "" : "s"}</div>
        </div>
        <button class="btn btn-sm btn-danger" data-del-team="${t.id}">Delete</button>
      </div>
    `;
  }).join("") : `<div class="empty"><p>No squads yet.</p></div>`;

  wrap.querySelectorAll("[data-del-team]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this squad? Players stay, just unassigned.")) return;
      await deleteDoc(doc(dbase, "teams", btn.dataset.delTeam));
      await refreshAll();
    });
  });
}

// ============================================================
// PAYMENTS
// ============================================================

function wirePaymentForm() {
  document.getElementById("paymentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const playerId = document.getElementById("payPlayer").value;
    const player = cache.players.find(p => p.id === playerId);
    const matchId = document.getElementById("payMatch").value;
    const match = cache.matches.find(m => m.id === matchId);

    let screenshotUrl = "";
    const file = document.getElementById("payScreenshot").files[0];
    if (file) {
      screenshotUrl = await uploadFile(`payments/${Date.now()}_${file.name}`, file);
    }

    await addDoc(collection(dbase, "payments"), {
      playerId,
      uid: player?.uid || null,
      matchId: matchId || null,
      matchTitle: match ? match.title : "",
      amount: Number(document.getElementById("payAmount").value) || 0,
      status: document.getElementById("payStatus").value,
      screenshotUrl,
      date: match ? match.date : new Date().toISOString(),
      createdAt: serverTimestamp(),
    });

    e.target.reset();
    await refreshAll();
  });
}

function renderPayments() {
  const wrap = document.getElementById("paymentRows");
  const playerMap = Object.fromEntries(cache.players.map(p => [p.id, p.ign]));
  wrap.innerHTML = cache.payments.length ? cache.payments.map(p => `
    <tr>
      <td>${escapeHtml(playerMap[p.playerId] || "Unknown")}</td>
      <td>${escapeHtml(p.matchTitle || "—")}</td>
      <td class="num">${fmtMoney(p.amount)}</td>
      <td>
        <select data-status-for="${p.id}">
          <option value="pending" ${p.status !== "paid" ? "selected" : ""}>Pending</option>
          <option value="paid" ${p.status === "paid" ? "selected" : ""}>Paid</option>
        </select>
      </td>
      <td>${p.screenshotUrl ? `<a href="#" data-view-img="${escapeHtml(p.screenshotUrl)}">View</a>` : "—"}</td>
      <td><button class="btn btn-sm btn-danger" data-del-payment="${p.id}">Delete</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6" class="empty"><p>No payments yet.</p></td></tr>`;

  wrap.querySelectorAll("[data-status-for]").forEach(sel => {
    sel.addEventListener("change", async () => {
      await updateDoc(doc(dbase, "payments", sel.dataset.statusFor), { status: sel.value });
      await refreshAll();
    });
  });

  wrap.querySelectorAll("[data-del-payment]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this payment record?")) return;
      await deleteDoc(doc(dbase, "payments", btn.dataset.delPayment));
      await refreshAll();
    });
  });

  wrap.querySelectorAll("[data-view-img]").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("viewImg").src = a.dataset.viewImg;
      document.getElementById("viewImgModal").classList.add("show");
    });
  });
}

function wireImgModal() {
  document.getElementById("closeImgModal").addEventListener("click", () => {
    document.getElementById("viewImgModal").classList.remove("show");
  });
  document.getElementById("viewImgModal").addEventListener("click", (e) => {
    if (e.target.id === "viewImgModal") e.currentTarget.classList.remove("show");
  });
}
