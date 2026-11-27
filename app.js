// SHAMLOKO BOOST - Phase 1 shell: auth, roles, profile, genres, wallet (read-only ledger view).
const C = window.BOOST_CONFIG;
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const K = (n) => "K" + Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TABS = ["Home", "Discover", "Compete", "Earn", "Grow", "Wallet", "Profile"];
const CREATOR_TABS = ["Creator Studio", "Campaign Manager", "Analytics"];
const CATS = ["Musician/Artist", "Influencer/Content Creator", "Video Producer", "Photographer", "Graphic Designer", "Business", "Brand", "Other"];
let db, user, roles = [], tab = "Home";

function toast(msg, bad) { const t = $("#toast"); t.textContent = msg; t.className = bad ? "bad" : ""; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 3500); }
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message || "Something went wrong", true); } }
const must = (r) => { if (r.error) throw r.error; return r.data; };

async function init() {
  if (!C || C.SUPABASE_URL.startsWith("PASTE")) { $("#app").innerHTML = '<div class="card"><h1>Setup needed</h1><p>Edit <b>js/config.js</b> and paste your Supabase URL and anon key.</p></div>'; return; }
  db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { db: { schema: "boost" }, auth: { storageKey: "boost-auth" } });
  db.auth.onAuthStateChange((_e, s) => { const u = s?.user || null; if ((u?.id || null) !== (user?.id || null)) { user = u; route(); } });
  user = (await db.auth.getSession()).data.session?.user || null;
  route();
}

async function route() {
  $("#nav").hidden = !user;
  if (!user) return authView();
  await guard(async () => {
    roles = must(await db.from("user_roles").select("role")).map((r) => r.role);
    const tabs = roles.includes("creator") ? TABS.concat(CREATOR_TABS) : TABS;
    $("#nav").innerHTML = tabs.map((t) => `<button class="${t === tab ? "on" : ""}" data-t="${esc(t)}">${esc(t)}</button>`).join("");
    $("#nav").onclick = (e) => { const t = e.target.dataset.t; if (t) { tab = t; route(); } };
    $("#app").onclick = null;
    const views = { Home: homeView, Discover: discoverView, Wallet: walletView, Profile: profileView };
    await (views[tab] || soonView)();
  });
}

function authView() {
  $("#app").innerHTML = `<h1 class="gold">SHAMLOKO BOOST</h1><p class="mute">Discover. Compete. Earn. Grow.</p>
  <div class="card"><input id="nm" placeholder="Full name (sign up only)"><input id="em" type="email" placeholder="Email" autocomplete="email">
  <input id="pw" type="password" placeholder="Password (min 8 characters)" autocomplete="current-password">
  <button id="in">Log in</button><button id="up" class="ghost">Create account</button></div>`;
  $("#in").onclick = () => guard(async () => { must(await db.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value })); });
  $("#up").onclick = () => guard(async () => {
    if ($("#pw").value.length < 8) throw new Error("Password must be at least 8 characters");
    const d = must(await db.auth.signUp({ email: $("#em").value.trim(), password: $("#pw").value, options: { data: { full_name: $("#nm").value.trim() } } }));
    toast(d.session ? "Welcome!" : "Check your email to confirm, then log in.");
  });
}

async function balances() {
  const r = await db.from("wallet_balances").select("*").maybeSingle();
  return r.data || { available: 0, pending: 0, reserved: 0 };
}

async function homeView() {
  const [b, p, n] = await Promise.all([balances(), db.from("profiles").select("full_name").eq("id", user.id).single(), db.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false)]);
  const creator = roles.includes("creator");
  $("#app").innerHTML = `<h1>Welcome${p.data?.full_name ? ", " + esc(p.data.full_name) : ""}</h1>
  <div class="grid"><div class="card"><div class="mute">Available</div><div class="big">${K(b.available)}</div></div>
  <div class="card"><div class="mute">Pending</div><div class="big">${K(b.pending)}</div></div>
  <div class="card"><div class="mute">${creator ? "Reserved" : "Unread"}</div><div class="big">${creator ? K(b.reserved) : n.count || 0}</div></div></div>
  <div class="card soon" style="margin-top:12px">Recommended activities, campaigns and competitions appear here once Earn, Compete and Campaigns are built (next phases).</div>`;
}

async function discoverView() {
  const [g, mine] = await Promise.all([db.from("genres").select("id,name").eq("active", true).order("name"), db.from("user_preferences").select("genre_id").eq("user_id", user.id)]);
  const sel = new Set((mine.data || []).map((x) => x.genre_id));
  $("#app").innerHTML = `<h1>Discover</h1><h2>Your music genres</h2><div class="chips">${(g.data || []).map((x) => `<button class="chip ${sel.has(x.id) ? "on" : ""}" data-g="${x.id}">${esc(x.name)}</button>`).join("")}</div>
  <div class="card soon" style="margin-top:16px">Music playback, artist profiles, search and sponsored placements arrive in the Discover phase.</div>`;
  $("#app").onclick = (e) => { const id = e.target.dataset.g; if (id) guard(async () => {
    if (sel.has(id)) must(await db.from("user_preferences").delete().eq("genre_id", id).eq("user_id", user.id));
    else must(await db.from("user_preferences").insert({ user_id: user.id, genre_id: id }));
    await discoverView(); }); };
}

async function walletView() {
  const [b, t] = await Promise.all([balances(), db.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)]);
  $("#app").innerHTML = `<h1>Wallet</h1><div class="grid"><div class="card"><div class="mute">Available</div><div class="big">${K(b.available)}</div></div>
  <div class="card"><div class="mute">Pending</div><div class="big">${K(b.pending)}</div></div><div class="card"><div class="mute">Reserved</div><div class="big">${K(b.reserved)}</div></div></div>
  <h2>Transactions</h2><div class="card">${(t.data || []).map((x) => `<div class="row"><span>${esc(x.type)} <span class="mute">${esc(x.bucket)} · ${new Date(x.created_at).toLocaleDateString()}</span></span><b>${K(x.amount)}</b></div>`).join("") || '<span class="mute">No transactions yet.</span>'}</div>
  <div class="card soon">Deposits and withdrawals (manual admin confirmation) arrive in the Wallet phase. Balances come only from the ledger and cannot be edited from this app.</div>`;
}

async function profileView() {
  const p = must(await db.from("profiles").select("*").eq("id", user.id).single());
  const cp = (await db.from("creator_profiles").select("*").eq("user_id", user.id).maybeSingle()).data;
  $("#app").innerHTML = `<h1>Profile</h1><div class="card"><input id="fn" placeholder="Full name" value="${esc(p.full_name)}"><input id="ph" placeholder="Phone" value="${esc(p.phone)}">
  <select id="vis"><option value="public" ${p.visibility === "public" ? "selected" : ""}>Public profile</option><option value="private" ${p.visibility === "private" ? "selected" : ""}>Private profile</option></select>
  <button id="sv">Save profile</button></div>
  <h2>Creator profile</h2><div class="card"><input id="cn" placeholder="Creator / brand name" value="${esc(cp?.display_name)}">
  <select id="cc">${CATS.map((c) => `<option ${cp?.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
  <textarea id="cb" rows="3" placeholder="Short bio">${esc(cp?.bio)}</textarea><button id="cs">${cp ? "Update creator profile" : "Become a creator"}</button></div>
  <button id="out" class="ghost">Log out</button>`;
  $("#sv").onclick = () => guard(async () => { must(await db.from("profiles").update({ full_name: $("#fn").value.trim(), phone: $("#ph").value.trim(), visibility: $("#vis").value }).eq("id", user.id)); toast("Saved"); });
  $("#cs").onclick = () => guard(async () => { if (!$("#cn").value.trim()) throw new Error("Enter a creator name"); must(await db.rpc("become_creator", { p_name: $("#cn").value.trim(), p_category: $("#cc").value, p_bio: $("#cb").value.trim() || null })); toast("Creator profile saved"); route(); });
  $("#out").onclick = () => db.auth.signOut();
}

function soonView() {
  $("#app").innerHTML = `<h1>${esc(tab)}</h1><div class="card soon"><b>Not built yet.</b> This section is scheduled for a later phase and has no working features today.</div>`;
}
init();
