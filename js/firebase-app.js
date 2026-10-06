import { firebaseAuth, firebaseStorage, firestore } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  getDownloadURL,
  ref,
  uploadBytes
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
let members = [];
let currentUser = null;
let scoringRules = [];
let chartInstance = null;

function ensureAuthModal() {
  if (document.getElementById('authModal') || document.getElementById('loginForm')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="authModal" class="modal" role="dialog" aria-modal="true" aria-label="Account access">
      <div class="modal-content card">
        <button class="modal-close" type="button" aria-label="Close" onclick="closeLoginModal()">&times;</button>
        <div class="auth-tabs" id="authTabs" role="tablist" aria-label="Account access">
          <button id="tabSignIn" class="tab active" type="button" role="tab" aria-selected="true" onclick="switchAuthTab('signin')">Sign In</button>
          <button id="tabSignUp" class="tab" type="button" role="tab" aria-selected="false" onclick="switchAuthTab('signup')">Sign Up</button>
        </div>
        <form id="loginForm" class="auth-form" onsubmit="event.preventDefault(); handleLogin();">
          <div class="field-group"><label for="loginEmail">Email</label><input id="loginEmail" type="email" required></div>
          <div class="field-group"><label for="loginPassword">Password</label><input id="loginPassword" type="password" required></div>
          <div class="actions"><button type="submit" class="btn primary">Sign In</button></div>
        </form>
        <form id="signupForm" class="auth-form" style="display:none;" onsubmit="event.preventDefault(); handleSignUp();">
          <div class="field-group"><label for="signUpName">Full Name</label><input id="signUpName" type="text" required></div>
          <div class="field-group"><label for="signUpEmail">Email</label><input id="signUpEmail" type="email" required></div>
          <div class="field-group"><label for="signUpPassword">Password</label><input id="signUpPassword" type="password" required></div>
          <div class="field-group"><label for="signUpDept">Department</label><select id="signUpDept" required><option value="">Select department</option><option value="oGT">oGT</option><option value="oGV">oGV</option></select></div>
          <div class="actions"><button type="submit" class="btn primary">Create Account</button></div>
        </form>
        <div id="profileDashboard" class="profile-dashboard" style="display:none;">
          <div class="profile-header"><img id="profileImage" src="assets/logo.png" alt="Profile photo" class="avatar"><div><div id="profileName" class="profile-name">Member</div><div id="profileDeptLabel"></div></div></div>
          <div class="profile-summary"><div><span>Points</span><strong id="profilePoints">0</strong></div><div><span>Total posts</span><strong id="profilePostTotal">0</strong></div></div>
          <div class="profile-actions"><button class="btn" type="button" onclick="handleLogout()">Logout</button></div>
        </div>
      </div>
    </div>`);
}

function applyAuthGate() {
  const form = document.getElementById('submitPostForm');
  const authMessage = document.getElementById('authAccessMessage');
  if (!form || !authMessage) return;

  const isAuthenticated = Boolean(currentUser);
  form.hidden = !isAuthenticated;
  authMessage.hidden = isAuthenticated;
  authMessage.textContent = 'Please sign in to your account to access this form.';
}

function init() {
  ensureAuthModal();
  document.getElementById('postCategory')?.addEventListener('change', updateKpiOptions);
  document.getElementById('postKpi')?.addEventListener('change', updateSignupControls);
  document.getElementById('signupCount')?.addEventListener('input', updatePointsPreview);

  onAuthStateChanged(firebaseAuth, async user => {
    currentUser = user;
    await Promise.all([loadMembers(), loadScoringRules()]);
    const member = members.find(item => item.id === user?.uid);
    if (user && member) showProfileView(user.uid);
    else resetAuthView();
    applyAuthGate();
    updateScoringForm();
    renderAll();
  });
}

async function loadMembers() {
  try {
    const [userSnapshot, postSnapshot] = await Promise.all([
      getDocs(collection(firestore, 'users')),
      getDocs(collection(firestore, 'posts'))
    ]);
    const postGroups = new Map();
    postSnapshot.forEach(postDocument => {
      const post = { id: postDocument.id, ...postDocument.data() };
      const submissions = postGroups.get(post.userId) || [];
      submissions.push(post);
      postGroups.set(post.userId, submissions);
    });
    members = userSnapshot.docs.map(userDocument => {
      const user = userDocument.data();
      const postSubmissions = postGroups.get(userDocument.id) || [];
      return {
        id: userDocument.id,
        name: user.name || 'Member',
        dept: user.department,
        avatar: user.photoUrl || null,
        postSubmissions,
        posts: postSubmissions.length,
        score: postSubmissions.reduce((total, post) => total + (post.pointsAwarded || 0), 0)
      };
    });
  } catch (error) {
    console.error('Could not load Firestore member data:', error);
    members = [];
  }
}

async function loadScoringRules() {
  try {
    const snapshot = await getDocs(collection(firestore, 'scoringRules'));
    scoringRules = snapshot.docs.map(ruleDocument => ({ id: ruleDocument.id, ...ruleDocument.data() }))
      .filter(rule => rule.active !== false);
  } catch (error) {
    console.error('Could not load Firestore scoring rules:', error);
    scoringRules = [];
  }
}

function resetAuthView() {
  const dashboard = document.getElementById('profileDashboard');
  const tabs = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  if (dashboard) dashboard.style.display = 'none';
  if (tabs) tabs.style.display = '';
  if (loginForm) loginForm.style.display = 'block';
  if (signupForm) signupForm.style.display = 'none';
  updateLoginButton('Login / Sign Up');
  applyAuthGate();
}

function openLoginModal() {
  ensureAuthModal();
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

function updateLoginButton(label) {
  const button = document.getElementById('loginBtn');
  if (button) button.innerHTML = `<i class="fa-regular fa-user"></i> ${label}`;
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const signInTab = document.getElementById('tabSignIn');
  const signUpTab = document.getElementById('tabSignUp');
  if (!loginForm || !signupForm) return;
  loginForm.style.display = tab === 'signin' ? 'block' : 'none';
  signupForm.style.display = tab === 'signup' ? 'block' : 'none';
  if (signInTab) {
    signInTab.classList.toggle('active', tab === 'signin');
    signInTab.setAttribute('aria-selected', String(tab === 'signin'));
  }
  if (signUpTab) {
    signUpTab.classList.toggle('active', tab === 'signup');
    signUpTab.setAttribute('aria-selected', String(tab === 'signup'));
  }
}

async function handleSignUp() {
  const name = document.getElementById('signUpName')?.value.trim();
  const email = document.getElementById('signUpEmail')?.value.trim();
  const password = document.getElementById('signUpPassword')?.value;
  const department = document.getElementById('signUpDept')?.value;
  if (!name || !email || !password || !department) return alert('Fill all fields.');

  try {
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await setDoc(doc(firestore, 'users', credential.user.uid), {
      name,
      department,
      photoUrl: null,
      createdAt: serverTimestamp()
    });
    const photo = document.getElementById('signUpPhoto')?.files?.[0];
    if (photo) await saveProfilePhoto(photo, credential.user.uid);
    await loadMembers();
    showProfileView(credential.user.uid);
    updateScoringForm();
    renderAll();
    closeLoginModal();
  } catch (error) {
    console.error('Sign-up failed:', error);
    alert(error.message || 'Could not create the account. Check Firebase setup and try again.');
  }
}

async function handleLogin() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) return alert('Enter your email and password.');
  try {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    closeLoginModal();
  } catch (error) {
    console.error('Sign-in failed:', error);
    alert(error.message || 'Could not sign in. Check your email and password.');
  }
}

async function handleLogout() {
  try {
    await signOut(firebaseAuth);
    resetAuthView();
  } catch (error) {
    console.error('Sign-out failed:', error);
    alert('Could not sign out. Please try again.');
  }
}

async function saveProfilePhoto(file, userId) {
  if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_SIZE) {
    throw new Error('Choose an image smaller than 5 MB.');
  }
  const photoReference = ref(firebaseStorage, `profile-photos/${userId}/profile`);
  await uploadBytes(photoReference, file, { contentType: file.type });
  const photoUrl = await getDownloadURL(photoReference);
  await updateDoc(doc(firestore, 'users', userId), { photoUrl });
  const member = members.find(item => item.id === userId);
  if (member) member.avatar = photoUrl;
  return photoUrl;
}

async function uploadProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file || !currentUser) return;
  try {
    const photoUrl = await saveProfilePhoto(file, currentUser.uid);
    const image = document.getElementById('profileImage');
    if (image) image.src = photoUrl;
    renderAll();
  } catch (error) {
    console.error('Photo upload failed:', error);
    alert(error.message || 'Could not upload the photo. Check that Firebase Storage is enabled.');
  }
}

function showProfileView(userId) {
  const member = members.find(item => item.id === userId);
  if (!member) return;
  const authTabs = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const dashboard = document.getElementById('profileDashboard');
  if (authTabs) authTabs.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
  if (signupForm) signupForm.style.display = 'none';
  if (dashboard) dashboard.style.display = 'block';
  const name = document.getElementById('profileName');
  if (name) name.textContent = member.name;
  const departmentLabel = document.getElementById('profileDeptLabel');
  if (departmentLabel) {
    departmentLabel.innerHTML = `<span class="dept-badge ${member.dept === 'oGV' ? 'ogv' : 'ogt'}">${member.dept}</span>`;
  }
  const points = document.getElementById('profilePoints');
  if (points) points.textContent = member.score;
  const postTotal = document.getElementById('profilePostTotal');
  if (postTotal) postTotal.textContent = member.posts;
  const image = document.getElementById('profileImage');
  if (image) image.src = member.avatar || 'assets/logo.png';
  updateLoginButton('My Profile');
  renderProfilePosts(member);
}

function renderProfilePosts(member) {
  const list = document.getElementById('profilePosts');
  if (!list) return;
  list.replaceChildren();
  const submissions = [...member.postSubmissions].reverse();
  if (!submissions.length) {
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
    details.textContent = [submission.kpi, submission.platform, submission.datePosted, `${submission.pointsAwarded} points`]
      .filter(Boolean).join(' | ');
    item.append(title, details);
    list.appendChild(item);
  });
}

function updateScoringForm() {
  const category = document.getElementById('postCategory');
  const status = document.getElementById('submissionStatus');
  if (!category) return;
  const department = members.find(member => member.id === currentUser?.uid)?.dept;
  const departmentRules = scoringRules.filter(rule => rule.department === department);
  category.replaceChildren(new Option('Select campaign category...', ''));
  [...new Set(departmentRules.map(rule => rule.category))].forEach(value => category.add(new Option(value, value)));
  category.disabled = !departmentRules.length;
  if (status) {
    status.textContent = !currentUser
      ? 'Sign in before submitting a post.'
      : !departmentRules.length
        ? 'Scoring rules are not loaded yet. They must be added to Firestore first.'
        : '';
  }
  updateKpiOptions();
}

function updateKpiOptions() {
  const category = document.getElementById('postCategory');
  const kpi = document.getElementById('postKpi');
  if (!category || !kpi) return;
  const department = members.find(member => member.id === currentUser?.uid)?.dept;
  const values = scoringRules
    .filter(rule => rule.department === department && rule.category === category.value)
    .map(rule => rule.kpi);
  kpi.replaceChildren(new Option('Select KPI...', ''));
  [...new Set(values)].forEach(value => kpi.add(new Option(value, value)));
  kpi.disabled = !values.length;
  updateSignupControls();
}

function getSignupRules() {
  const department = members.find(member => member.id === currentUser?.uid)?.dept;
  const category = document.getElementById('postCategory')?.value;
  const kpi = document.getElementById('postKpi')?.value;
  return scoringRules.filter(rule =>
    rule.department === department && rule.category === category && rule.kpi === kpi
  ).sort((left, right) => (left.minSignupCount ?? -1) - (right.minSignupCount ?? -1));
}

function updateSignupControls() {
  const group = document.getElementById('signupCountGroup');
  const count = document.getElementById('signupCount');
  const label = document.getElementById('signupMetricLabel');
  if (!group || !count || !label) return;
  const rules = getSignupRules();
  const metricRule = rules.find(rule => rule.signupMetric);
  group.hidden = !metricRule;
  count.required = Boolean(metricRule);
  if (metricRule) {
    label.textContent = `${metricRule.signupMetric} count`;
    count.min = String(Math.min(...rules.filter(rule => rule.signupMetric).map(rule => rule.minSignupCount)));
  } else {
    count.value = '0';
  }
  updatePointsPreview();
}

function updatePointsPreview() {
  const preview = document.getElementById('pointsPreview');
  if (!preview) return;
  const rules = getSignupRules();
  const metricRule = rules.find(rule => rule.signupMetric);
  const signupCount = metricRule ? Number(document.getElementById('signupCount')?.value) : 0;
  const matchedRule = rules.find(rule => {
    if (!rule.signupMetric) return !metricRule;
    return Number.isInteger(signupCount)
      && signupCount >= rule.minSignupCount
      && (rule.maxSignupCount == null || signupCount <= rule.maxSignupCount);
  });
  preview.textContent = matchedRule ? `${matchedRule.points} points` : 'Select a KPI and valid SU count';
}

async function handleSubmitPost() {
  if (!currentUser) return alert('Please sign in to submit a post.');
  const member = members.find(item => item.id === currentUser.uid);
  const title = document.getElementById('postTitle')?.value.trim();
  const datePosted = document.getElementById('postDate')?.value;
  const platform = document.getElementById('postPlatform')?.value;
  const category = document.getElementById('postCategory')?.value;
  const kpi = document.getElementById('postKpi')?.value;
  const rules = getSignupRules();
  const metricRule = rules.find(rule => rule.signupMetric);
  const signupCount = metricRule ? Number(document.getElementById('signupCount')?.value) : 0;
  const matchedRule = rules.find(rule => {
    if (!rule.signupMetric) return !metricRule;
    return Number.isInteger(signupCount)
      && signupCount >= rule.minSignupCount
      && (rule.maxSignupCount == null || signupCount <= rule.maxSignupCount);
  });

  if (!member || !title || !datePosted || !platform || !category || !kpi || !matchedRule) {
    return alert('Complete the post details and choose a valid signup count.');
  }

  try {
    await addDoc(collection(firestore, 'posts'), {
      userId: currentUser.uid,
      department: member.dept,
      category,
      kpi,
      signupMetric: matchedRule.signupMetric,
      signupCount,
      title,
      platform,
      datePosted,
      scoringRuleId: matchedRule.id,
      pointsAwarded: matchedRule.points,
      createdAt: serverTimestamp()
    });
    await loadMembers();
    renderAll();
    document.getElementById('submitPostForm')?.reset();
    updateScoringForm();
    const status = document.getElementById('submissionStatus');
    if (status) status.textContent = `Post submitted. ${matchedRule.points} points awarded.`;
  } catch (error) {
    console.error('Post submission failed:', error);
    alert(error.message || 'Could not submit the post. Check the Firestore rules and try again.');
  }
}

function renderAll() {
  renderIndividualLeaderboard();
  renderDeptPages();
  renderChart();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

function renderIndividualLeaderboard() {
  const podium = document.getElementById('individualPodium');
  const body = document.getElementById('individualBody');
  if (!podium || !body) return;
  const sorted = [...members].sort((left, right) => right.score - left.score);
  podium.replaceChildren();
  sorted.slice(0, 3).forEach((member, index) => {
    const rank = index + 1;
    const place = document.createElement('div');
    place.className = `podium-place place-${rank}`;
    place.innerHTML = `<div class="podium-medal"><i class="fa-solid fa-medal"></i><span>${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'}</span></div><div class="podium-avatar">${escapeHtml(getInitials(member.name))}</div><div class="name">${escapeHtml(member.name)}</div><div class="podium-dept">${member.dept}</div><div class="score">${member.score} <span>points</span></div>`;
    podium.appendChild(place);
  });
  if (!sorted.length) podium.innerHTML = '<div class="podium-empty"><i class="fa-solid fa-trophy"></i><span>No members on the podium yet</span></div>';

  body.replaceChildren();
  if (!sorted.length) {
    body.innerHTML = '<tr class="leaderboard-empty-row"><td colspan="5">No members yet. Create an account to appear here.</td></tr>';
  }
  sorted.forEach((member, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="tbl-rank">${index + 1}</td><td class="tbl-member"><span class="tbl-avatar">${escapeHtml(getInitials(member.name))}</span> ${escapeHtml(member.name)}</td><td class="tbl-dept"><span class="dept-badge ${member.dept === 'oGV' ? 'ogv' : 'ogt'}">${member.dept}</span></td><td class="tbl-posts">${member.posts}</td><td class="tbl-points">${member.score}</td>`;
    body.appendChild(row);
  });

  const total = document.getElementById('totalMembers');
  if (total) total.textContent = String(members.length);
  const ogt = document.getElementById('ogtCount');
  if (ogt) ogt.textContent = String(members.filter(member => member.dept === 'oGT').length);
  const ogv = document.getElementById('ogvCount');
  if (ogv) ogv.textContent = String(members.filter(member => member.dept === 'oGV').length);
  const leader = document.getElementById('leadingMember');
  if (leader) leader.textContent = sorted[0] ? `${sorted[0].name} (${sorted[0].score})` : '—';
}

function renderDeptPages() {
  for (const department of ['oGT', 'oGV']) {
    const prefix = department.toLowerCase();
    const podium = document.getElementById(`${prefix}Podium`);
    const body = document.getElementById(`${prefix}Body`);
    if (!podium || !body) continue;
    const departmentMembers = members.filter(member => member.dept === department)
      .sort((left, right) => right.score - left.score);
    podium.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const member = departmentMembers[index];
      const place = document.createElement('div');
      place.className = 'individual-pod';
      place.innerHTML = member
        ? `<div style="font-size:18px;">${index + 1}</div><div class="name">${escapeHtml(member.name)}</div><div class="score">${member.score}</div>`
        : `<div style="font-size:18px;">${index + 1}</div><div class="name">—</div>`;
      podium.appendChild(place);
    }
    body.replaceChildren();
    departmentMembers.forEach((member, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td style="padding:8px">${index + 1}</td><td style="padding:8px">${escapeHtml(member.name)}</td><td style="padding:8px">${member.posts}</td><td style="padding:8px">${member.score}</td>`;
      body.appendChild(row);
    });
  }
}

function renderChart() {
  const canvas = document.getElementById('pointsChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const topMembers = [...members].sort((left, right) => right.score - left.score).slice(0, 8);
  const labels = topMembers.map(member => member.name);
  const points = topMembers.map(member => member.score);
  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = points;
    chartInstance.update();
    return;
  }
  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Points', data: points, backgroundColor: labels.map((_, index) => index === 0 ? '#ffd700' : 'rgba(115,146,214,0.6)') }] },
    options: { indexAxis: 'y', responsive: true, scales: { x: { beginAtZero: true } } }
  });
}

window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.switchAuthTab = switchAuthTab;
window.handleSignUp = handleSignUp;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.uploadProfilePhoto = uploadProfilePhoto;
window.showProfileView = showProfileView;
window.handleSubmitPost = handleSubmitPost;

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
else init();