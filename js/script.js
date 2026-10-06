// Shared app logic for Campaign Sprinter
// Data model: members stored in localStorage under 'ogx_members'

const STORAGE_KEY = 'ogx_members';
const POINTS_PER_POST = 5;
const DEMO_MEMBERS = [
  { id: 'demo-1001', name: 'Maya Chen (Demo)', email: 'maya.demo@example.com', password: 'demo123', dept: 'oGT', score: 60, posts: 12, avatar: null },
  { id: 'demo-1002', name: 'Leo Martin (Demo)', email: 'leo.demo@example.com', password: 'demo123', dept: 'oGV', score: 45, posts: 9, avatar: null },
  { id: 'demo-1003', name: 'Priya Shah (Demo)', email: 'priya.demo@example.com', password: 'demo123', dept: 'oGT', score: 40, posts: 8, avatar: null },
  { id: 'demo-1004', name: 'Noah Kim (Demo)', email: 'noah.demo@example.com', password: 'demo123', dept: 'oGV', score: 30, posts: 6, avatar: null },
  { id: 'demo-1005', name: 'Asha Patel (Demo)', email: 'asha.demo@example.com', password: 'demo123', dept: 'oGT', score: 20, posts: 4, avatar: null }
];

let members = [];
let currentMemberId = null;

function loadMembers(){
  members = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if(!members.length){
    members = DEMO_MEMBERS.map(member => ({...member}));
    saveMembers();
  }
}
function saveMembers(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(members)); }

function ensureAuthModal(){
  if(document.getElementById('authModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="authModal" class="modal" role="dialog" aria-modal="true" aria-label="Account access">
      <div class="modal-content card">
        <button class="modal-close" type="button" aria-label="Close" onclick="closeLoginModal()">&times;</button>
        <div class="auth-tabs" id="authTabs" role="tablist" aria-label="Account access">
          <button id="tabSignIn" class="tab active" type="button" role="tab" aria-selected="true" onclick="switchAuthTab('signin')">Sign In</button>
          <button id="tabSignUp" class="tab" type="button" role="tab" aria-selected="false" onclick="switchAuthTab('signup')">Sign Up</button>
        </div>
        <form id="loginForm" class="auth-form">
          <div class="field-group"><label for="loginEmail"><i class="fa-regular fa-envelope"></i> Email</label><input id="loginEmail" type="email" required placeholder="name@aiesec.net"></div>
          <div class="field-group"><label for="loginPassword"><i class="fa-solid fa-lock"></i> Password</label><input id="loginPassword" type="password" required placeholder="••••••••"></div>
          <div class="actions"><button type="submit" class="btn primary"><i class="fa-solid fa-right-to-bracket"></i> Sign In</button></div>
          <p class="auth-switch-copy">Don't have an account? <button type="button" onclick="switchAuthTab('signup')">Sign up</button></p>
        </form>
        <form id="signupForm" class="auth-form" style="display:none;">
          <div class="field-group"><label for="signUpName"><i class="fa-regular fa-user"></i> Full Name</label><input id="signUpName" type="text" required placeholder="John Doe"></div>
          <div class="field-group"><label for="signUpEmail"><i class="fa-regular fa-envelope"></i> Email</label><input id="signUpEmail" type="email" required placeholder="name@aiesec.net"></div>
          <div class="field-group"><label for="signUpPassword"><i class="fa-solid fa-lock"></i> Password</label><input id="signUpPassword" type="password" required placeholder="••••••••"></div>
          <div class="field-group"><label for="signUpDept"><i class="fa-solid fa-sitemap"></i> Department</label><select id="signUpDept" required><option value="">Select department</option><option value="oGT">oGT</option><option value="oGV">oGV</option></select></div>
          <div class="actions"><button type="submit" class="btn primary"><i class="fa-solid fa-user-plus"></i> Create Account</button></div>
          <p class="auth-switch-copy">Already have an account? <button type="button" onclick="switchAuthTab('signin')">Sign in</button></p>
        </form>
        <div id="profileDashboard" class="profile-dashboard" style="display:none;">
          <div class="profile-header">
            <img id="profileImage" src="assets/logo.png" alt="Profile photo" class="avatar">
            <div><div id="profileName" class="profile-name">Member</div><div id="profileDeptLabel"></div></div>
          </div>
          <div class="profile-summary">
            <div><span>Points</span><strong id="profilePoints">0</strong></div>
            <div><span>Total posts</span><strong id="profilePostTotal">0</strong></div>
          </div>
          <div class="profile-actions"><button class="btn" type="button" onclick="handleLogout()"><i class="fa-solid fa-right-from-bracket"></i> Logout</button></div>
        </div>
      </div>
    </div>`);
  document.getElementById('loginForm').addEventListener('submit', event => { event.preventDefault(); handleLogin(); });
  document.getElementById('signupForm').addEventListener('submit', event => { event.preventDefault(); handleSignUp(); });
}

function init(){
  ensureAuthModal();
  loadMembers();
  const storedId = localStorage.getItem('ogx_current_member');
  const storedMember = members.find(member => String(member.id) === storedId);
  if(storedMember) showProfileView(storedMember.id);
  renderAll();
}

window.addEventListener('DOMContentLoaded', init);

/* Modal + Auth */
function openLoginModal(){ ensureAuthModal(); const modal = document.getElementById('authModal'); if(modal) modal.style.display = 'flex'; }
function closeLoginModal(){ const modal = document.getElementById('authModal'); if(modal) modal.style.display = 'none'; }

function updateLoginButton(label){
  const loginButton = document.getElementById('loginBtn');
  if(loginButton) loginButton.innerHTML = `<i class="fa-regular fa-user"></i> ${label}`;
}

function switchAuthTab(tab){
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const signInTab = document.getElementById('tabSignIn');
  const signUpTab = document.getElementById('tabSignUp');
  if(tab === 'signin'){ loginForm.style.display='block'; signupForm.style.display='none'; }
  else { loginForm.style.display='none'; signupForm.style.display='block'; }
  if(signInTab){ signInTab.classList.toggle('active', tab === 'signin'); signInTab.setAttribute('aria-selected', String(tab === 'signin')); }
  if(signUpTab){ signUpTab.classList.toggle('active', tab === 'signup'); signUpTab.setAttribute('aria-selected', String(tab === 'signup')); }
}

function handleSignUp(){
  const name = document.getElementById('signUpName').value.trim();
  const email = document.getElementById('signUpEmail').value.trim();
  const password = document.getElementById('signUpPassword').value;
  const dept = document.getElementById('signUpDept').value;
  if(!name||!email||!password||!dept) return alert('Fill all fields');
  if(members.find(m=>m.email===email)) return alert('Email already registered');
  const createMember = avatar => {
    const m = { id: Date.now(), name, email, password, dept, score:0, posts:0, avatar };
    members.push(m); saveMembers();
    currentMemberId = m.id; localStorage.setItem('ogx_current_member', String(m.id));
    showProfileView(m.id); renderAll();
  };
  const photo = document.getElementById('signUpPhoto')?.files?.[0];
  if(!photo) return createMember(null);
  const reader = new FileReader();
  reader.onload = () => createMember(reader.result);
  reader.onerror = () => alert('Could not read the selected profile photo');
  reader.readAsDataURL(photo);
}

function handleLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const pwd = document.getElementById('loginPassword') ? document.getElementById('loginPassword').value : null;
  const m = members.find(x=>x.email===email && x.password===pwd);
  if(!m) return alert('Credentials not found');
  currentMemberId = m.id; localStorage.setItem('ogx_current_member', String(m.id));
  showProfileView(m.id); renderAll();
}

function handleLogout(){
  currentMemberId = null;
  localStorage.removeItem('ogx_current_member');
  const dashboard = document.getElementById('profileDashboard');
  const tabs = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  if(dashboard) dashboard.style.display='none';
  if(tabs) tabs.style.display='';
  if(loginForm) loginForm.style.display='block';
  if(signupForm) signupForm.style.display='none';
  updateLoginButton('Login / Sign Up');
}

function uploadProfilePhoto(e){
  const f = e.target.files && e.target.files[0]; if(!f || !currentMemberId) return;
  const r = new FileReader(); r.onload = function(ev){ const m=members.find(x=>x.id===currentMemberId); if(m){ m.avatar = ev.target.result; saveMembers(); renderAll(); document.getElementById('profileImage') && (document.getElementById('profileImage').src = m.avatar); } }; r.readAsDataURL(f);
}

function showProfileView(memberId){
  const m = members.find(x=>x.id===memberId); if(!m) return;
  currentMemberId = m.id; localStorage.setItem('ogx_current_member', String(m.id));
  const authTabs = document.getElementById('authTabs'); if(authTabs) authTabs.style.display='none';
  const loginForm = document.getElementById('loginForm'); if(loginForm) loginForm.style.display='none';
  const signupForm = document.getElementById('signupForm'); if(signupForm) signupForm.style.display='none';
  const dash = document.getElementById('profileDashboard'); if(dash) dash.style.display='block';
  document.getElementById('profileName') && (document.getElementById('profileName').textContent = m.name);
  const deptLabel = document.getElementById('profileDeptLabel'); if(deptLabel) deptLabel.innerHTML = `<span class="dept-badge ${m.dept==='oGV'?'ogv':'ogt'}">${m.dept}</span>`;
  document.getElementById('postCount') && (document.getElementById('postCount').value = m.posts || 0);
  document.getElementById('profilePoints') && (document.getElementById('profilePoints').textContent = m.score || 0);
  document.getElementById('profilePostTotal') && (document.getElementById('profilePostTotal').textContent = m.posts || 0);
  document.getElementById('profileImage') && (document.getElementById('profileImage').src = m.avatar || 'assets/logo.png');
  updateLoginButton('My Profile');
  renderProfilePosts(m);
}

function renderProfilePosts(member){
  const list = document.getElementById('profilePosts');
  if(!list) return;
  list.replaceChildren();
  const submissions = Array.isArray(member.postSubmissions) ? member.postSubmissions.slice().reverse() : [];
  if(!submissions.length){
    const empty = document.createElement('li');
    empty.className = 'profile-post-empty';
    empty.textContent = 'No submitted posts yet.';
    list.appendChild(empty);
    return;
  }
  submissions.forEach(submission => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    const details = document.createElement('span');
    title.textContent = submission.title;
    details.textContent = [submission.platform, submission.date].filter(Boolean).join(' | ');
    item.append(title, details);
    list.appendChild(item);
  });
}

function updatePostCount(){ if(!currentMemberId) return alert('Sign in first'); const v = Number(document.getElementById('postCount').value || 0); const m = members.find(x=>x.id===currentMemberId); if(!m) return; m.posts = v; m.score = (m.posts||0)*POINTS_PER_POST; saveMembers(); renderAll(); showProfileView(m.id); alert('Saved'); }

/* Submit Post Page */
function handleSubmitPost(){
  if(!currentMemberId) return alert('Please sign in to submit a post');
  const title = document.getElementById('postTitle').value.trim();
  const date = document.getElementById('postDate').value;
  const platform = document.getElementById('postPlatform').value;
  if(!title||!date||!platform) return alert('Fill all fields');
  // increment posts and points
  const m = members.find(x=>x.id===currentMemberId); if(!m) return alert('Member not found');
  if(!Array.isArray(m.postSubmissions)) m.postSubmissions = [];
  m.postSubmissions.push({title, date, platform});
  m.posts = (m.posts||0) + 1; m.score = (m.score||0) + POINTS_PER_POST; saveMembers(); renderAll(); alert('Post submitted. +5 points');
  document.getElementById('submitPostForm') && document.getElementById('submitPostForm').reset();
}

/* Rendering */
function renderAll(){ renderIndividualLeaderboard(); renderDeptPages(); renderChart(); }

function renderIndividualLeaderboard(){
  // dashboard podium and table
  const podium = document.getElementById('individualPodium'); const body = document.getElementById('individualBody'); if(!podium||!body) return;
  const sorted = members.slice().sort((a,b)=> (b.score||0)-(a.score||0));
  podium.innerHTML = '';
  const topMembers = sorted.slice(0, 3);
  if (!topMembers.length) {
    podium.innerHTML = '<div class="podium-empty"><i class="fa-solid fa-trophy"></i><span>No members on the podium yet</span></div>';
  }
  topMembers.forEach((m, index) => {
    const rank = index + 1;
    const initials = m.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    const pod = document.createElement('div');
    pod.className = `podium-place place-${rank}`;
    pod.innerHTML = `
      <div class="podium-medal"><i class="fa-solid fa-medal"></i><span>${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</span></div>
      <div class="podium-avatar" aria-hidden="true">${initials}</div>
      <div class="name">${m.name}</div>
      <div class="podium-dept">${m.dept}</div>
      <div class="score">${m.score || 0} <span>points</span></div>
    `;
    podium.appendChild(pod);
  });

  body.innerHTML = '';
  if (!sorted.length) {
    body.innerHTML = '<tr class="leaderboard-empty-row"><td colspan="5">No members yet. Create an account to appear here.</td></tr>';
  }
  sorted.forEach((m, idx) => {
    const tr = document.createElement('tr');
    const initials = m.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    tr.innerHTML = `
      <td class="tbl-rank">${idx+1}</td>
      <td class="tbl-member"><span class="tbl-avatar" aria-hidden="true">${initials}</span> ${m.name}</td>
      <td class="tbl-dept"><span class="dept-badge ${m.dept==='oGV'?'ogv':'ogt'}">${m.dept}</span></td>
      <td class="tbl-posts">${m.posts||0}</td>
      <td class="tbl-points">${m.score||0}</td>
    `;
    body.appendChild(tr);
  });

  // update stats
  document.getElementById('totalMembers') && (document.getElementById('totalMembers').textContent = members.length);
  document.getElementById('ogtCount') && (document.getElementById('ogtCount').textContent = members.filter(x=>x.dept==='oGT').length);
  document.getElementById('ogvCount') && (document.getElementById('ogvCount').textContent = members.filter(x=>x.dept==='oGV').length);
  const leader = sorted[0]; document.getElementById('leadingMember') && (document.getElementById('leadingMember').textContent = leader ? `${leader.name} (${leader.score||0})` : '—');
}

function renderDeptPages(){
  // ogt
  const ogtPodium = document.getElementById('ogtPodium'); const ogtBody = document.getElementById('ogtBody'); if(ogtPodium && ogtBody){ const list = members.filter(x=>x.dept==='oGT').sort((a,b)=> (b.score||0)-(a.score||0)); ogtPodium.innerHTML=''; for(let i=0;i<3;i++){ const m=list[i]; const pod=document.createElement('div'); pod.className='individual-pod'; pod.innerHTML = m ? `<div style="font-size:18px;">${i+1}</div><div class="name">${m.name}</div><div class="score">${m.score||0}</div>` : `<div style="font-size:18px;">${i+1}</div><div class="name">—</div>`; ogtPodium.appendChild(pod);} ogtBody.innerHTML=''; list.forEach((m,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td style="padding:8px">${idx+1}</td><td style="padding:8px">${m.name}</td><td style="padding:8px">${m.posts||0}</td><td style="padding:8px">${m.score||0}</td>`; ogtBody.appendChild(tr); }); }

  // ogv
  const ogvPodium = document.getElementById('ogvPodium'); const ogvBody = document.getElementById('ogvBody'); if(ogvPodium && ogvBody){ const list = members.filter(x=>x.dept==='oGV').sort((a,b)=> (b.score||0)-(a.score||0)); ogvPodium.innerHTML=''; for(let i=0;i<3;i++){ const m=list[i]; const pod=document.createElement('div'); pod.className='individual-pod'; pod.innerHTML = m ? `<div style="font-size:18px;">${i+1}</div><div class="name">${m.name}</div><div class="score">${m.score||0}</div>` : `<div style="font-size:18px;">${i+1}</div><div class="name">—</div>`; ogvPodium.appendChild(pod);} ogvBody.innerHTML=''; list.forEach((m,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td style="padding:8px">${idx+1}</td><td style="padding:8px">${m.name}</td><td style="padding:8px">${m.posts||0}</td><td style="padding:8px">${m.score||0}</td>`; ogvBody.appendChild(tr); }); }
}

/* Chart rendering using Chart.js */
let chartInstance = null;
function renderChart(){
  const ctx = document.getElementById('pointsChart'); if(!ctx) return;
  const sorted = members.slice().sort((a,b)=> (b.score||0)-(a.score||0)).slice(0,8);
  const labels = sorted.map(m=>m.name);
  const data = sorted.map(m=>m.score||0);
  if(chartInstance) { chartInstance.data.labels = labels; chartInstance.data.datasets[0].data = data; chartInstance.update(); return; }
  chartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets:[{ label:'Points', data, backgroundColor: labels.map((_,i)=> i===0?'#ffd700': 'rgba(115,146,214,0.6)') }] }, options: { indexAxis:'y', responsive:true, scales:{ x:{ beginAtZero:true } } } });
}

/* Expose handlers to global */
window.openLoginModal = openLoginModal; window.closeLoginModal = closeLoginModal; window.switchAuthTab = switchAuthTab;
window.handleSignUp = handleSignUp; window.handleLogin = handleLogin; window.handleLogout = handleLogout;
window.uploadProfilePhoto = uploadProfilePhoto; window.showProfileView = showProfileView; window.updatePostCount = updatePostCount;
window.handleSubmitPost = handleSubmitPost;
