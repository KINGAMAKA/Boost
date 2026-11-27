// SHAMLOKO BOOST - Phase 2 app flow and funding foundation.
const C = window.BOOST_CONFIG;
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const K = n => "K" + Number(n || 0).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2});
const CATS = ["Musician/Artist","Influencer/Content Creator","Video Producer","Photographer","Graphic Designer","Business","Brand","Other"];
const EARN_NAV = ["Ways to Earn","Discover","Compete","Wallet","Profile"];
const CREATOR_NAV = ["Get Discovered","Campaigns","Wallet","Profile"];
let db,user,roles=[],mode="earner",tab="Ways to Earn",profile=null,creatorProfile=null,catalog=[];
let toastTimer;

function toast(msg,bad=false){
 const t=$("#toast");t.textContent=msg;t.className=bad?"bad":"";t.style.display="block";
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.style.display="none",3800);
}
async function guard(fn){try{await fn()}catch(e){console.error(e);toast(e.message||"Something went wrong",true)}}
function must(r){if(r.error)throw r.error;return r.data}
function isAdmin(){return roles.includes("admin")}
function navItems(){return mode==="creator"?CREATOR_NAV:EARN_NAV}
function setMode(next){
 mode=next;localStorage.setItem("boost-mode",mode);
 tab=mode==="creator"?"Get Discovered":"Ways to Earn";route();
}
async function init(){
 if(!C||!C.SUPABASE_URL||C.SUPABASE_URL.startsWith("PASTE")){
  $("#app").innerHTML='<div class="card"><h1 class="gold">Setup required</h1><p>Edit <b>js/config.js</b> and add your Supabase project URL and anon/publishable key.</p></div>';return;
 }
 db=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{db:{schema:"boost"},auth:{storageKey:"boost-auth"}});
 db.auth.onAuthStateChange((_e,s)=>{const next=s?.user||null;if((next?.id||null)!==(user?.id||null)){user=next;route()}});
 user=(await db.auth.getSession()).data.session?.user||null;
 mode=localStorage.getItem("boost-mode")==="creator"?"creator":"earner";
 await route();
}
async function route(){
 $("#nav").hidden=!user;
 if(!user){authView();return}
 await guard(async()=>{
  roles=must(await db.from("user_roles").select("role")).map(x=>x.role);
  if(mode==="creator"&&!roles.includes("creator"))mode="earner";
  profile=must(await db.from("profiles").select("*").eq("id",user.id).single());
  creatorProfile=(await db.from("creator_profiles").select("*").eq("user_id",user.id).maybeSingle()).data;
  const r=await db.from("service_catalog").select("*").order("sort_order");
  catalog=must(r);
  renderShell();
  const views={"Ways to Earn":earnerHome,"Get Discovered":creatorHome,"Discover":discoverView,"Compete":competeView,"Campaigns":campaignsView,"Wallet":walletView,"Profile":profileView,"Admin":adminView};
  await (views[tab]||earnerHome)();
 });
}
function renderShell(){
 const items=navItems().concat(isAdmin()?["Admin"]:[]);
 $("#nav").innerHTML=items.map(x=>`<button data-tab="${esc(x)}" class="${x===tab?"on":""}">${esc(x)}</button>`).join("");
 $("#nav").onclick=e=>{const t=e.target.closest("button")?.dataset.tab;if(t){tab=t;route()}};
}
function authView(){
 $("#nav").hidden=true;
 $("#app").innerHTML=`
 <div class="auth-wrap">
  <div class="hero"><div class="brand gold">SHAMLOKO BOOST</div><h1>Discover. Compete.<br><span class="gold">Earn. Grow.</span></h1><p class="muted">A platform connecting audiences, creators and opportunities.</p></div>
  <div class="hero-grid">
   <div class="card"><div class="eyebrow">For earners</div><h3>Turn attention into opportunity.</h3><p class="muted">Listen, compete, complete tasks and earn kwacha.</p></div>
   <div class="card"><div class="eyebrow">For creators</div><h3>Find your audience.</h3><p class="muted">Get discovered, receive real feedback and run competitions.</p></div>
  </div>
  <div class="card">
   <div class="mode-switch" style="width:100%;justify-content:center"><button id="show-login" class="active">Log in</button><button id="show-register">Register</button></div>
   <div id="auth-fields"><div id="name-wrap" hidden><label>Full name</label><input id="nm" autocomplete="name" placeholder="Your full name"></div>
    <label>Email</label><input id="em" type="email" autocomplete="email" placeholder="you@example.com">
    <label>Password</label><input id="pw" type="password" autocomplete="current-password" placeholder="At least 8 characters">
    <button id="auth-submit">Log in</button>
   </div>
   <p class="hint" id="auth-hint">Welcome back. Log in to continue.</p>
  </div>
 </div>`;
 let registering=false;
 const toggle=on=>{registering=on;$("#name-wrap").hidden=!on;$("#auth-submit").textContent=on?"Create account":"Log in";$("#show-login").classList.toggle("active",!on);$("#show-register").classList.toggle("active",on);$("#auth-hint").textContent=on?"Your account opens in Earner mode.":"Welcome back. Log in to continue."};
 $("#show-login").onclick=()=>toggle(false);$("#show-register").onclick=()=>toggle(true);
 $("#auth-submit").onclick=()=>guard(async()=>{
  const email=$("#em").value.trim(),password=$("#pw").value;
  if(!email||!password)throw Error("Enter your email and password.");
  if(registering){
   if(password.length<8)throw Error("Password must be at least 8 characters.");
   const full_name=$("#nm").value.trim();if(!full_name)throw Error("Enter your full name.");
   const d=must(await db.auth.signUp({email,password,options:{data:{full_name}}}));
   toast(d.session?"Account created. Welcome to BOOST!":"Account created. Check your email to confirm, then log in.");
  }else{must(await db.auth.signInWithPassword({email,password}));}
 });
}
function modeBar(){
 return `<div class="modebar"><div><div class="brand">SHAMLOKO <span class="gold">BOOST</span></div><div class="muted">Discover. Compete. Earn. Grow.</div></div>
 <div class="mode-switch"><button data-mode="earner" class="${mode==="earner"?"active":""}">Earner</button><button data-mode="creator" class="${mode==="creator"?"active":""}">Creator</button></div></div>`;
}
function bindMode(){
 document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>guard(async()=>{
  const next=b.dataset.mode;
  if(next==="creator"&&!roles.includes("creator")){creatorSetupView();return}
  setMode(next);
 }));
}
function page(content){$("#app").innerHTML=modeBar()+content;bindMode()}
function serviceCard(s){
 const live=s.status==="live";
 let reward="";
 if(s.side==="earner"&&s.reward_min!==null)reward=s.reward_min===s.reward_max?`Earn ${K(s.reward_min)}`:`Earn ${K(s.reward_min)}–${K(s.reward_max)}`;
 return `<div class="card"><div class="service"><div class="service-icon">${iconFor(s.service_key)}</div><div class="service-copy"><div class="card-head"><h3>${esc(s.title)}</h3><span class="pill ${live?"live":"soon"}">${live?"Available":"Coming soon"}</span></div><p>${esc(s.description)}</p><div class="service-foot"><b class="gold">${esc(reward|| (s.side==="creator"&&s.service_key==="sample_music"?"Pricing shown before launch":""))}</b>${live?'<span class="muted">Ready</span>':'<span class="muted">Not yet available</span>'}</div></div></div></div>`;
}
function iconFor(k){return ({discover_artist:"♫",compete:"🏆",complete:"✓",video_review:"▶",music_review:"♫",content_rating:"★",audience_survey:"▤",content_comparison:"⇄",website_testing:"⌘",product_feedback:"✦",focus_group:"◎",promo_content:"✎",sample_music:"♫",run_competition:"🏆",get_reviews:"✎",testing_feedback:"⌘"})[k]||"✦"}
async function balances(){
 const d=must(await db.from("wallet_balances").select("*").eq("user_id",user.id).maybeSingle());
 return d||{available:0,pending:0,reserved:0};
}
async function stats(){
 const tx=must(await db.from("wallet_transactions").select("amount,bucket,type,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(500));
 const earned=tx.filter(x=>Number(x.amount)>0&&["task_reward","competition_prize","campaign_reward","reward_credit"].includes(x.type)).reduce((a,x)=>a+Number(x.amount),0);
 const spent=tx.filter(x=>Number(x.amount)<0).reduce((a,x)=>a+Math.abs(Number(x.amount)),0);
 return {tx,earned,spent};
}
async function earnerHome(){
 const items=catalog.filter(x=>x.side==="earner");
 const b=await balances();
 page(`<div class="eyebrow">Earner mode</div><h1>Ways to Earn</h1><p class="muted">Choose an opportunity. Rewards and conditions are shown before you participate.</p>
 <div class="grid3"><div class="stat"><span>Available</span><strong>${K(b.available)}</strong></div><div class="stat"><span>Pending</span><strong>${K(b.pending)}</strong></div><div class="stat"><span>Reserved</span><strong>${K(b.reserved)}</strong></div></div>
 <h2>Start earning</h2>${items.map(serviceCard).join("")}
 <div class="notice">BOOST rewards genuine participation and useful feedback. We do not pay for external likes, follows, subscriptions or views.</div>`);
}
async function creatorHome(){
 const items=catalog.filter(x=>x.side==="creator");
 const b=await balances();
 page(`<div class="eyebrow">Creator mode</div><h1>Get Discovered</h1><p class="muted">Reach real listeners, learn what resonates and grow with useful feedback.</p>
 <div class="grid3"><div class="stat"><span>Available</span><strong>${K(b.available)}</strong></div><div class="stat"><span>Pending</span><strong>${K(b.pending)}</strong></div><div class="stat"><span>Reserved</span><strong>${K(b.reserved)}</strong></div></div>
 <div class="card soft"><div class="eyebrow">Featured service</div><h3>Sample your music to listeners</h3><p class="muted">The first creator campaign type is planned for Phase 3. Deposit funds now to prepare your creator wallet.</p><button data-go-wallet>Open wallet</button></div>
 <h2>Ways to be discovered</h2>${items.map(serviceCard).join("")}`);
 $("#app").querySelector("[data-go-wallet]").onclick=()=>{tab="Wallet";route()};
}
async function discoverView(){
 const [genres,mine]=await Promise.all([db.from("genres").select("id,name").eq("active",true).order("name"),db.from("user_preferences").select("genre_id").eq("user_id",user.id)]);
 const selected=new Set((mine.data||[]).map(x=>x.genre_id));
 page(`<div class="eyebrow">Your interests</div><h1>Discover</h1><p class="muted">Choose the music genres you want to see more often. Artist listening campaigns arrive in Phase 3.</p>
 <div class="chips">${(genres.data||[]).map(g=>`<button class="small ghost" data-genre="${g.id}" style="${selected.has(g.id)?"border-color:var(--gold);color:var(--gold)":""}">${esc(g.name)}</button>`).join("")}</div>
 <div class="card dashed"><h3>Discover an Artist</h3><p class="muted">Music campaigns, audio playback and feedback submissions are being built in Phase 3. This screen currently saves your genre preferences only.</p><span class="pill soon">Phase 3</span></div>`);
 $("#app").onclick=e=>{const id=e.target.closest("[data-genre]")?.dataset.genre;if(!id)return;guard(async()=>{
  if(selected.has(id))must(await db.from("user_preferences").delete().eq("genre_id",id).eq("user_id",user.id));
  else must(await db.from("user_preferences").insert({user_id:user.id,genre_id:id}));
  await discoverView();
 })};
}
async function competeView(){
 const s=catalog.find(x=>x.side==="earner"&&x.service_key==="compete");
 page(`<div class="eyebrow">Earner mode</div><h1>Compete</h1>${serviceCard(s||{side:"earner",title:"Competitions",description:"Creative competitions and prizes.",status:"coming_soon",service_key:"compete"})}<p class="muted">Competition rules, entry requirements and prize conditions will be visible before entries open in Phase 4.</p>`);
}
async function campaignsView(){
 page(`<div class="eyebrow">Creator mode</div><h1>Campaigns</h1><div class="card dashed"><h3>Campaign manager</h3><p class="muted">Music campaign creation, publishing, participant management and results are Phase 3. No campaign can be published or charged in Phase 2.</p><span class="pill soon">Coming in Phase 3</span></div>`);
}
async function walletView(){
 const [b,tx,req]=await Promise.all([balances(),db.from("wallet_transactions").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),db.from("deposit_requests").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20)]);
 const requests=must(req);
 page(`<div class="eyebrow">Wallet</div><h1>Your funds</h1>
 <div class="grid3"><div class="stat"><span>Available</span><strong>${K(b.available)}</strong></div><div class="stat"><span>Pending</span><strong>${K(b.pending)}</strong></div><div class="stat"><span>Reserved</span><strong>${K(b.reserved)}</strong></div></div>
 <div class="card"><h3>Request a deposit</h3><p class="muted">Select an amount and submit a request. Funds are added only after an admin manually confirms receipt.</p>
 <div class="amount-list">${[50,100,250,500,1000,2500,5000].map(n=>`<button class="ghost" data-amount="${n}">K${n.toLocaleString("en")}</button>`).join("")}</div>
 <label>Custom amount (K)</label><input id="custom-amount" type="number" min="50" max="100000" step="0.01" placeholder="Enter another amount">
 <label>Payment method / channel</label><select id="pay-method"><option value="Mobile money">Mobile money</option><option value="Bank transfer">Bank transfer</option><option value="Other">Other</option></select>
 <label>Payment reference (optional)</label><input id="pay-ref" maxlength="120" placeholder="Transaction reference">
 <label>Note (optional)</label><textarea id="pay-note" maxlength="500" placeholder="Any details for the admin"></textarea>
 <button id="request-deposit">Submit deposit request</button><p class="hint">Do not submit a request until you have made, or are ready to make, the payment through the agreed channel.</p></div>
 <h2>Deposit requests</h2><div class="card">${requests.length?requests.map(x=>`<div class="row"><span><b>${K(x.amount)}</b><br><span class="muted">${new Date(x.created_at).toLocaleString()} · ${esc(x.payment_method)}</span></span><span class="pill ${x.status==="confirmed"?"live":x.status==="pending"?"soon":""}">${esc(x.status)}</span></div>`).join(""):'<div class="empty">No deposit requests yet.</div>'}</div>
 <h2>Wallet activity</h2><div class="card">${(tx.data||[]).length?(tx.data||[]).map(x=>`<div class="row"><span>${esc(x.type)}<br><span class="muted">${esc(x.bucket)} · ${new Date(x.created_at).toLocaleDateString()}</span></span><b>${K(x.amount)}</b></div>`).join(""):'<div class="empty">No transactions yet.</div>'}</div>`);
 let chosen=null;
 document.querySelectorAll("[data-amount]").forEach(btn=>btn.onclick=()=>{chosen=Number(btn.dataset.amount);$("#custom-amount").value=chosen;document.querySelectorAll("[data-amount]").forEach(x=>x.classList.toggle("selected",x===btn))});
 $("#request-deposit").onclick=()=>guard(async()=>{
  const amount=Number($("#custom-amount").value);if(!Number.isFinite(amount)||amount<50)throw Error("Enter a deposit amount of at least K50.");
  must(await db.rpc("request_deposit",{p_amount:amount,p_payment_method:$("#pay-method").value,p_payment_reference:$("#pay-ref").value.trim()||null,p_user_note:$("#pay-note").value.trim()||null}));
  toast("Deposit request submitted. It is awaiting manual confirmation.");await walletView();
 });
}
async function profileView(){
 const [b,s,g,mine]=await Promise.all([balances(),stats(),db.from("genres").select("id,name").eq("active",true).order("name"),db.from("user_preferences").select("genre_id").eq("user_id",user.id)]);
 const chosen=new Set((mine.data||[]).map(x=>x.genre_id));
 const recent=s.tx.slice(0,5);
 let modeStats=mode==="creator"?`<div class="stat"><span>Lifetime wallet outflow</span><strong>${K(s.spent)}</strong></div><div class="stat"><span>Reserved funds</span><strong>${K(b.reserved)}</strong></div>`:`<div class="stat"><span>Lifetime rewards</span><strong>${K(s.earned)}</strong></div><div class="stat"><span>Wallet available</span><strong>${K(b.available)}</strong></div>`;
 page(`<div class="eyebrow">Your account</div><h1>Profile</h1><div class="grid2">${modeStats}<div class="stat"><span>Pending</span><strong>${K(b.pending)}</strong></div></div>
 <div class="card"><h3>Profile settings</h3><label>Full name</label><input id="full-name" value="${esc(profile.full_name||"")}" maxlength="120">
 <label>Phone</label><input id="phone" value="${esc(profile.phone||"")}" maxlength="40">
 <label>Profile visibility</label><select id="visibility"><option value="public" ${profile.visibility==="public"?"selected":""}>Public</option><option value="private" ${profile.visibility==="private"?"selected":""}>Private</option></select>
 <button id="save-profile">Save profile</button></div>
 <div class="card"><h3>Music interests</h3><p class="muted">Your genre choices are used to personalise discovery.</p><div class="chips">${(g.data||[]).map(x=>`<button class="small ghost" data-profile-genre="${x.id}" style="${chosen.has(x.id)?"border-color:var(--gold);color:var(--gold)":""}">${esc(x.name)}</button>`).join("")}</div></div>
 ${roles.includes("creator")?`<div class="card"><h3>Creator profile</h3><label>Creator / brand name</label><input id="creator-name" value="${esc(creatorProfile?.display_name||"")}"><label>Category</label><select id="creator-category">${CATS.map(c=>`<option ${creatorProfile?.category===c?"selected":""}>${esc(c)}</option>`).join("")}</select><label>Bio</label><textarea id="creator-bio">${esc(creatorProfile?.bio||"")}</textarea><button id="save-creator">Save creator profile</button></div>`:""}
 <h2>Recent activity</h2><div class="card">${recent.length?recent.map(x=>`<div class="row"><span>${esc(x.type)}<br><span class="muted">${new Date(x.created_at).toLocaleDateString()}</span></span><b>${K(x.amount)}</b></div>`).join(""):'<div class="empty">Your recent activity will appear here.</div>'}</div>
 <button id="logout" class="ghost">Log out</button>`);
 $("#save-profile").onclick=()=>guard(async()=>{must(await db.from("profiles").update({full_name:$("#full-name").value.trim(),phone:$("#phone").value.trim(),visibility:$("#visibility").value}).eq("id",user.id));toast("Profile saved.");profile.full_name=$("#full-name").value.trim();profile.phone=$("#phone").value.trim();profile.visibility=$("#visibility").value});
 document.querySelectorAll("[data-profile-genre]").forEach(btn=>btn.onclick=()=>guard(async()=>{
  const id=btn.dataset.profileGenre;if(chosen.has(id))must(await db.from("user_preferences").delete().eq("user_id",user.id).eq("genre_id",id));else must(await db.from("user_preferences").insert({user_id:user.id,genre_id:id}));await profileView();
 }));
 if($("#save-creator"))$("#save-creator").onclick=()=>guard(async()=>{must(await db.rpc("become_creator",{p_name:$("#creator-name").value.trim(),p_category:$("#creator-category").value,p_bio:$("#creator-bio").value.trim()||null}));toast("Creator profile updated.");await route()});
 $("#logout").onclick=()=>db.auth.signOut();
}
function creatorSetupView(){
 page(`<div class="eyebrow">One-time setup</div><h1>Become a creator</h1><p class="muted">Set up your public creator profile to switch into Creator mode. You can still use Earner mode with the same account.</p>
 <div class="card"><label>Creator / brand name</label><input id="new-creator-name" maxlength="120" placeholder="Name shown to the community">
 <label>Category</label><select id="new-creator-category">${CATS.map(c=>`<option>${esc(c)}</option>`).join("")}</select>
 <label>Short bio</label><textarea id="new-creator-bio" maxlength="500" placeholder="What do you create?"></textarea>
 <button id="create-creator">Create creator profile</button><button id="cancel-creator" class="ghost">Not now</button></div>`);
 $("#create-creator").onclick=()=>guard(async()=>{
  const name=$("#new-creator-name").value.trim();if(!name)throw Error("Enter a creator or brand name.");
  must(await db.rpc("become_creator",{p_name:name,p_category:$("#new-creator-category").value,p_bio:$("#new-creator-bio").value.trim()||null}));
  roles=must(await db.from("user_roles").select("role")).map(x=>x.role);creatorProfile=must(await db.from("creator_profiles").select("*").eq("user_id",user.id).single());
  setMode("creator");toast("Creator mode is ready.");
 });
 $("#cancel-creator").onclick=()=>{mode="earner";tab="Ways to Earn";route()};
}
async function adminView(){
 if(!isAdmin()){tab=mode==="creator"?"Get Discovered":"Ways to Earn";route();return}
 const r=must(await db.from("deposit_requests").select("*,profiles(full_name)").eq("status","pending").order("created_at",{ascending:true}));
 page(`<div class="eyebrow">Restricted access</div><h1>Deposit review</h1><p class="muted">Confirm only after verifying the payment has actually been received. Confirmation credits the user's wallet once.</p>
 ${r.length?r.map(x=>`<div class="card"><div class="card-head"><div><h3>${K(x.amount)}</h3><div class="muted">${esc(x.profiles?.full_name||"BOOST user")} · ${new Date(x.created_at).toLocaleString()}</div></div><span class="pill soon">Pending</span></div>
 <p class="muted">Method: ${esc(x.payment_method)}<br>Reference: ${esc(x.payment_reference||"Not supplied")}<br>Note: ${esc(x.user_note||"—")}</p>
 <label>Admin note (optional)</label><input data-admin-note="${x.id}" maxlength="500" placeholder="Verification details">
 <div class="actions"><button data-confirm="${x.id}">Confirm payment</button><button class="ghost" data-reject="${x.id}">Reject</button></div></div>`).join(""):'<div class="card empty">No pending deposit requests.</div>'}`);
 document.querySelectorAll("[data-confirm]").forEach(btn=>btn.onclick=()=>guard(async()=>{
  if(!confirm("Confirm that this payment has been received?"))return;
  const id=btn.dataset.confirm,note=document.querySelector(`[data-admin-note="${id}"]`).value;
  must(await db.rpc("confirm_deposit",{p_request_id:id,p_admin_note:note||null}));toast("Deposit confirmed and credited.");await adminView();
 }));
 document.querySelectorAll("[data-reject]").forEach(btn=>btn.onclick=()=>guard(async()=>{
  const id=btn.dataset.reject,note=document.querySelector(`[data-admin-note="${id}"]`).value;
  must(await db.rpc("reject_deposit",{p_request_id:id,p_admin_note:note||null}));toast("Deposit request rejected.");await adminView();
 }));
}
init();
