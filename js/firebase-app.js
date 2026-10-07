import { firebaseAuth, firestore } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const AVATAR_DEFAULTS = {
  skinTone: '#dca77c',
  hairStyle: 'short',
  hairColor: '#211915',
  outfitColor: '#4874d2'
};
const AVATAR_OPTIONS = {
  skinTone: [
    ['#f3c6a5', 'Light'],
    ['#dca77c', 'Medium'],
    ['#9b6548', 'Brown'],
    ['#603b2b', 'Deep']
  ],
  hairStyle: [
    ['short', 'Short'],
    ['long', 'Long'],
    ['curly', 'Curly']
  ],
  hairColor: [
    ['#211915', 'Black'],
    ['#754c24', 'Brown'],
    ['#c58b38', 'Blonde'],
    ['#b84d35', 'Auburn']
  ],
  outfitColor: [
    ['#4874d2', 'Blue'],
    ['#f0761f', 'Orange'],
    ['#37a58b', 'Green'],
    ['#9a63c7', 'Purple']
  ]
};

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
        <button id="googleAuthButton" class="btn google-auth" type="button" onclick="handleGoogleSignIn()"><i class="fa-brands fa-google"></i> Continue with Google</button>
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
        <form id="googleProfileForm" class="auth-form" style="display:none;" onsubmit="event.preventDefault(); handleGoogleProfileSetup();">
          <p class="google-profile-copy">Choose your department to finish setting up your account.</p>
          <div class="field-group"><label for="googleProfileDept">Department</label><select id="googleProfileDept" required><option value="">Select department</option><option value="oGT">oGT</option><option value="oGV">oGV</option></select></div>
          <div class="actions"><button type="submit" class="btn primary">Complete profile</button></div>
        </form>
        <div id="profileDashboard" class="profile-dashboard" style="display:none;">
          <div class="profile-header"><img id="profileImage" src="assets/logo.png" alt="Generated profile avatar" class="avatar"><div><div id="profileName" class="profile-name">Member</div><div id="profileDeptLabel"></div></div></div>
          <div class="profile-summary"><div><span>Points</span><strong id="profilePoints">0</strong></div><div><span>Total posts</span><strong id="profilePostTotal">0</strong></div></div>
          <div class="profile-actions"><button class="btn" type="button" onclick="handleLogout()">Logout</button></div>
        </div>
      </div>
    </div>`);
}

function applyAuthGate() {
  const isAuthenticated = Boolean(currentUser && members.some(member => member.id === currentUser.uid));
  document.querySelectorAll('.nav a.nav-link[href$="submit-post.html"]').forEach(link => {
    link.hidden = !isAuthenticated;
  });

  const form = document.getElementById('submitPostForm');
  const authMessage = document.getElementById('authAccessMessage');
  if (!form || !authMessage) return;

  form.hidden = !isAuthenticated;
  authMessage.hidden = isAuthenticated;
  authMessage.textContent = 'Please sign in to your account to access this form.';
}

function init() {
  ensureAuthModal();
  ensureSignupAvatarEditor();
  document.getElementById('postCategory')?.addEventListener('change', updateKpiOptions);
  document.getElementById('postKpi')?.addEventListener('change', updateSignupControls);
  document.getElementById('signupCount')?.addEventListener('input', updatePointsPreview);

  onAuthStateChanged(firebaseAuth, async user => {
    currentUser = user;
    applyAuthGate();
    await Promise.all([loadMembers(), loadScoringRules()]);
    const member = members.find(item => item.id === user?.uid);
    if (user && member) showProfileView(user.uid);
    else if (user?.providerData.some(provider => provider.providerId === 'google.com')) showGoogleProfileSetup();
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
        avatarConfig: user.avatarConfig || null,
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
  const googleProfileForm = document.getElementById('googleProfileForm');
  const googleAuthButton = document.getElementById('googleAuthButton');
  if (dashboard) dashboard.style.display = 'none';
  if (tabs) tabs.style.display = '';
  if (googleAuthButton) googleAuthButton.hidden = false;
  if (googleProfileForm) googleProfileForm.style.display = 'none';
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
      avatarConfig: getSignupAvatarConfig(),
      createdAt: serverTimestamp()
    });
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

async function handleGoogleSignIn() {
  try {
    const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    const profile = await getDoc(doc(firestore, 'users', credential.user.uid));
    if (profile.exists()) closeLoginModal();
    else showGoogleProfileSetup();
  } catch (error) {
    console.error('Google sign-in failed:', error);
    alert(error.message || 'Could not sign in with Google. Please try again.');
  }
}

function showGoogleProfileSetup() {
  const dashboard = document.getElementById('profileDashboard');
  const tabs = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const googleAuthButton = document.getElementById('googleAuthButton');
  const profileForm = document.getElementById('googleProfileForm');
  if (dashboard) dashboard.style.display = 'none';
  if (tabs) tabs.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
  if (signupForm) signupForm.style.display = 'none';
  if (googleAuthButton) googleAuthButton.hidden = true;
  if (profileForm) profileForm.style.display = 'block';
  openLoginModal();
}

async function handleGoogleProfileSetup() {
  const department = document.getElementById('googleProfileDept')?.value;
  if (!currentUser || !department) return alert('Select your department to continue.');

  try {
    const profileRef = doc(firestore, 'users', currentUser.uid);
    const profile = await getDoc(profileRef);
    if (!profile.exists()) {
      const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Member';
      await setDoc(profileRef, {
        name,
        department,
        photoUrl: null,
        avatarConfig: { ...AVATAR_DEFAULTS },
        createdAt: serverTimestamp()
      });
    }
    await loadMembers();
    showProfileView(currentUser.uid);
    updateScoringForm();
    renderAll();
    closeLoginModal();
  } catch (error) {
    console.error('Google profile setup failed:', error);
    alert(error.message || 'Could not finish setting up your account. Please try again.');
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

function showProfileView(userId) {
  const member = members.find(item => item.id === userId);
  if (!member) return;
  const authTabs = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const googleProfileForm = document.getElementById('googleProfileForm');
  const googleAuthButton = document.getElementById('googleAuthButton');
  const dashboard = document.getElementById('profileDashboard');
  if (authTabs) authTabs.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
  if (signupForm) signupForm.style.display = 'none';
  if (googleProfileForm) googleProfileForm.style.display = 'none';
  if (googleAuthButton) googleAuthButton.hidden = true;
  if (dashboard) dashboard.style.display = 'block';
  const avatarBuilder = ensureAvatarBuilder(dashboard);
  if (avatarBuilder) {
    for (const [key, value] of Object.entries(getAvatarConfig(member.avatarConfig))) {
      const select = avatarBuilder.querySelector(`[data-avatar-option="${key}"]`);
      if (select) select.value = value;
    }
    avatarBuilder.hidden = true;
  }
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
  if (image) {
    image.src = createGeneratedAvatar(member.name, member.avatarConfig);
    image.alt = `Custom avatar for ${member.name}`;
  }
  updateLoginButton('My Profile');
  renderProfilePosts(member);
}

function getAvatarConfig(config) {
  const avatar = config && typeof config === 'object' ? config : {};
  return Object.fromEntries(Object.entries(AVATAR_DEFAULTS).map(([key, fallback]) => {
    const allowedValues = AVATAR_OPTIONS[key].map(([value]) => value);
    return [key, allowedValues.includes(avatar[key]) ? avatar[key] : fallback];
  }));
}

function createGeneratedAvatar(name, config) {
  const avatar = getAvatarConfig(config);
  const hairBehindHead = avatar.hairStyle === 'long'
    ? `<path d="M27 60c-6-30 8-48 37-48s43 18 37 48l-3 43H30z" fill="${avatar.hairColor}"/>`
    : avatar.hairStyle === 'curly'
      ? `<path d="M31 48c-9-23 6-37 17-34 6-13 27-12 33-2 17-4 27 15 17 31l-2 12H32z" fill="${avatar.hairColor}"/>`
      : `<path d="M29 55c-3-27 10-43 35-43s38 16 35 43l-8 10H36z" fill="${avatar.hairColor}"/>`;
  const hairFront = avatar.hairStyle === 'curly'
    ? `<path d="M31 48c2-17 12-25 20-20 8-12 20-10 25-2 10-7 20 1 21 15-7-5-11-4-16 1-7-6-14-5-20 1-9-6-19-4-30 5z" fill="${avatar.hairColor}"/>`
    : avatar.hairStyle === 'long'
      ? `<path d="M32 42c4-21 17-30 32-30s28 9 32 30c-9-7-18-9-28-8-15 1-24 9-36 8z" fill="${avatar.hairColor}"/>`
      : `<path d="M30 45c5-22 17-33 34-33s29 11 34 33c-11-8-21-10-34-8-13-2-23 0-34 8z" fill="${avatar.hairColor}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><clipPath id="circle"><circle cx="64" cy="64" r="63"/></clipPath></defs><g clip-path="url(#circle)"><rect width="128" height="128" fill="#dbe8ff"/><path d="M18 132c3-27 17-39 46-39s43 12 46 39" fill="${avatar.outfitColor}"/><path d="M52 81h24v23H52z" fill="${avatar.skinTone}"/>${hairBehindHead}<ellipse cx="64" cy="57" rx="32" ry="38" fill="${avatar.skinTone}"/>${hairFront}<ellipse cx="51" cy="61" rx="3" ry="4" fill="#29211e"/><ellipse cx="77" cy="61" rx="3" ry="4" fill="#29211e"/><path d="M57 77c4 4 10 4 14 0" fill="none" stroke="#8f4d48" stroke-width="3" stroke-linecap="round"/></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function ensureSignupAvatarEditor() {
  const signupForm = document.getElementById('signupForm');
  if (!signupForm || signupForm.querySelector('.signup-avatar-editor')) return;

  const actions = signupForm.querySelector('.actions');
  if (!actions) return;
  const editor = document.createElement('section');
  editor.className = 'signup-avatar-editor';
  editor.innerHTML = `
    <h3>Create your avatar <span>(optional)</span></h3>
    <div class="signup-avatar-preview-wrap">
      <img class="signup-avatar-preview" alt="Preview of your custom avatar">
    </div>
    <div class="avatar-builder-options">
      <label>Skin tone<select data-signup-avatar-option="skinTone"></select></label>
      <label>Hair style<select data-signup-avatar-option="hairStyle"></select></label>
      <label>Hair color<select data-signup-avatar-option="hairColor"></select></label>
      <label>Outfit color<select data-signup-avatar-option="outfitColor"></select></label>
    </div>`;

  for (const [key, options] of Object.entries(AVATAR_OPTIONS)) {
    const select = editor.querySelector(`[data-signup-avatar-option="${key}"]`);
    for (const [value, label] of options) select.add(new Option(label, value));
    select.value = AVATAR_DEFAULTS[key];
    select.addEventListener('change', () => updateSignupAvatarPreview(editor));
  }
  document.getElementById('signUpName')?.addEventListener('input', () => updateSignupAvatarPreview(editor));
  actions.insertAdjacentElement('beforebegin', editor);
  updateSignupAvatarPreview(editor);
}

function getSignupAvatarConfig() {
  const editor = document.querySelector('.signup-avatar-editor');
  if (!editor) return { ...AVATAR_DEFAULTS };
  return getAvatarConfig(Object.fromEntries(Object.keys(AVATAR_DEFAULTS).map(key => [
    key,
    editor.querySelector(`[data-signup-avatar-option="${key}"]`)?.value
  ])));
}

function updateSignupAvatarPreview(editor) {
  const name = document.getElementById('signUpName')?.value.trim() || 'Your avatar';
  const image = editor.querySelector('.signup-avatar-preview');
  image.src = createGeneratedAvatar(name, getSignupAvatarConfig());
}

function ensureAvatarBuilder(dashboard) {
  if (!dashboard) return null;
  let builder = dashboard.querySelector('.avatar-builder');
  if (builder) return builder;

  const profileHeader = dashboard.querySelector('.profile-header');
  if (!profileHeader) return null;
  builder = document.createElement('section');
  builder.className = 'avatar-builder';
  builder.innerHTML = `
    <button type="button" class="btn secondary avatar-builder-toggle" aria-expanded="false">Customize avatar</button>
    <div class="avatar-builder-panel" hidden>
      <p>Make your own look. Your choices are saved to your account.</p>
      <div class="avatar-builder-options">
        <label>Skin tone<select data-avatar-option="skinTone"></select></label>
        <label>Hair style<select data-avatar-option="hairStyle"></select></label>
        <label>Hair color<select data-avatar-option="hairColor"></select></label>
        <label>Outfit color<select data-avatar-option="outfitColor"></select></label>
      </div>
      <button type="button" class="btn primary avatar-builder-save">Save avatar</button>
      <p class="avatar-builder-status" role="status" aria-live="polite"></p>
    </div>`;

  for (const [key, options] of Object.entries(AVATAR_OPTIONS)) {
    const select = builder.querySelector(`[data-avatar-option="${key}"]`);
    for (const [value, label] of options) select.add(new Option(label, value));
    select.addEventListener('change', () => updateAvatarPreview(builder));
  }

  const toggle = builder.querySelector('.avatar-builder-toggle');
  const panel = builder.querySelector('.avatar-builder-panel');
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  builder.querySelector('.avatar-builder-save').addEventListener('click', () => saveAvatarConfig(builder));
  profileHeader.insertAdjacentElement('afterend', builder);
  return builder;
}

function readAvatarBuilderConfig(builder) {
  return Object.fromEntries(Object.keys(AVATAR_DEFAULTS).map(key => [
    key,
    builder.querySelector(`[data-avatar-option="${key}"]`).value
  ]));
}

function updateAvatarPreview(builder) {
  const member = members.find(item => item.id === currentUser?.uid);
  const image = document.getElementById('profileImage');
  if (member && image) image.src = createGeneratedAvatar(member.name, readAvatarBuilderConfig(builder));
}

async function saveAvatarConfig(builder) {
  if (!currentUser) return;
  const status = builder.querySelector('.avatar-builder-status');
  try {
    const avatarConfig = getAvatarConfig(readAvatarBuilderConfig(builder));
    await updateDoc(doc(firestore, 'users', currentUser.uid), { avatarConfig });
    const member = members.find(item => item.id === currentUser.uid);
    if (member) member.avatarConfig = avatarConfig;
    updateAvatarPreview(builder);
    status.textContent = 'Avatar saved to your account.';
  } catch (error) {
    console.error('Could not save avatar:', error);
    status.textContent = 'Could not save your avatar. Please try again.';
  }
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
  const categoryPrompt = !currentUser
    ? 'Sign in to load categories...'
    : !departmentRules.length
      ? 'No categories available for your department'
      : 'Select campaign category...';
  category.replaceChildren(new Option(categoryPrompt, ''));
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
    place.innerHTML = `<div class="podium-medal"><i class="fa-solid fa-medal"></i><span>${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'}</span></div><img class="podium-avatar" src="${createGeneratedAvatar(member.name, member.avatarConfig)}" alt=""><div class="name">${escapeHtml(member.name)}</div><div class="podium-dept">${member.dept}</div><div class="score">${member.score} <span>points</span></div>`;
    podium.appendChild(place);
  });
  if (!sorted.length) podium.innerHTML = '<div class="podium-empty"><i class="fa-solid fa-trophy"></i><span>No members on the podium yet</span></div>';

  body.replaceChildren();
  if (!sorted.length) {
    body.innerHTML = '<tr class="leaderboard-empty-row"><td colspan="5">No members yet. Create an account to appear here.</td></tr>';
  }
  sorted.forEach((member, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="tbl-rank">${index + 1}</td><td class="tbl-member"><img class="tbl-avatar" src="${createGeneratedAvatar(member.name, member.avatarConfig)}" alt=""> ${escapeHtml(member.name)}</td><td class="tbl-dept"><span class="dept-badge ${member.dept === 'oGV' ? 'ogv' : 'ogt'}">${member.dept}</span></td><td class="tbl-posts">${member.posts}</td><td class="tbl-points">${member.score}</td>`;
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
        ? `<div style="font-size:18px;">${index + 1}</div><img class="pod-avatar" src="${createGeneratedAvatar(member.name, member.avatarConfig)}" alt=""><div class="name">${escapeHtml(member.name)}</div><div class="score">${member.score}</div>`
        : `<div style="font-size:18px;">${index + 1}</div><div class="name">—</div>`;
      podium.appendChild(place);
    }
    body.replaceChildren();
    departmentMembers.forEach((member, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td style="padding:8px">${index + 1}</td><td style="padding:8px"><img class="tbl-avatar" src="${createGeneratedAvatar(member.name, member.avatarConfig)}" alt=""> ${escapeHtml(member.name)}</td><td style="padding:8px">${member.posts}</td><td style="padding:8px">${member.score}</td>`;
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
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleGoogleProfileSetup = handleGoogleProfileSetup;
window.handleLogout = handleLogout;
window.showProfileView = showProfileView;
window.handleSubmitPost = handleSubmitPost;

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
else init();