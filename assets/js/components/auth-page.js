function authV(){
  const t = S.tab;
  const isReg = S.reg && t === 'user';
  const isAdmin = t === 'admin';

  return `
  <div class="auth-page-wrap">
    <div class="auth-card">
      
      <!-- Brand -->
      <div class="auth-brand-row">
        ${brand(32)}
      </div>

      <!-- EXACTLY 2 LOGINS: User Login vs Admin Login (Driver removed) -->
      <div class="auth-role-tabs">
        <button class="auth-role-btn ${!isAdmin ? 'active' : ''}" onclick="S.tab='user';S.err='';render()">
          ${ic('user', 16)}
          <span>User Login</span>
        </button>
        <button class="auth-role-btn ${isAdmin ? 'active' : ''}" onclick="S.tab='admin';S.reg=0;S.err='';render()">
          ${ic('shield', 16)}
          <span>Admin Login</span>
        </button>
      </div>

      <!-- Header Title -->
      <div class="auth-title-block">
        <h2>${isAdmin ? 'Admin Console' : isReg ? 'Create Account' : 'Sign in to UrbanRide'}</h2>
        <p>${isAdmin ? 'Restricted platform operations and monitoring portal.' : isReg ? 'Book seats or share your ride with one unified account.' : 'Enter your credentials to access your trips and routes.'}</p>
      </div>

      <!-- Sign In vs Sign Up Tab for User mode -->
      ${!isAdmin ? `
      <div class="auth-sub-toggle">
        <button class="auth-sub-btn ${!isReg ? 'active' : ''}" onclick="S.reg=0;S.err='';render()">Sign In</button>
        <button class="auth-sub-btn ${isReg ? 'active' : ''}" onclick="S.reg=1;S.err='';render()">Sign Up</button>
      </div>
      ` : ''}

      <!-- Error Alert -->
      ${S.err ? `
      <div class="auth-error">
        ${ic('alert', 16)}
        <span>${S.err}</span>
      </div>
      ` : ''}

      <form id="auth-form" autocomplete="on" onsubmit="event.preventDefault();${isReg ? 'register()' : 'login()'}">
      <!-- Form Inputs -->
      ${isReg ? `
      <div class="auth-field">
        <label>Full Name</label>
        <div class="auth-input-box">
          <span class="auth-field-icon">${ic('user', 18)}</span>
          <input id="an" name="name" autocomplete="name" placeholder="John Doe">
        </div>
      </div>
      ` : ''}

      <div class="auth-field">
        <label>Email Address</label>
        <div class="auth-input-box">
          <span class="auth-field-icon">${ic('mail', 18)}</span>
          <input id="ae" name="${isReg ? 'email' : 'username'}" type="email" autocomplete="${isReg ? 'email' : 'username'}" placeholder="name@domain.com" value="${isReg ? '' : getRememberedEmail()}">
        </div>
      </div>

      <div class="auth-field">
        <label><span>Password</span></label>
        <div class="auth-input-box">
          <span class="auth-field-icon">${ic('lock', 18)}</span>
          <input id="ap" name="password" type="${S.showPw ? 'text' : 'password'}" autocomplete="${isReg ? 'new-password' : 'current-password'}" placeholder="Enter password" value="">
          <button type="button" class="pw-toggle-btn" onclick="togglePassword()" aria-label="Toggle password view" aria-pressed="${S.showPw}">
            <span id="pw-toggle-icon">${ic(S.showPw ? 'eyeOff' : 'eye', 18)}</span>
          </button>
        </div>
      </div>

      ${!isReg ? `<label class="auth-remember-login"><input id="remember-login" type="checkbox" ${S.rememberLogin||getRememberedEmail()?'checked':''} onchange="S.rememberLogin=this.checked"><span>Remember me on this device</span></label>` : ''}

      ${isReg ? `
      <div class="auth-field">
        <label>Vehicle Model &amp; Registration <span style="color:#64748b;font-weight:400">(Optional if not driving)</span></label>
        <div class="auth-input-box">
          <span class="auth-field-icon">${ic('car', 18)}</span>
          <input id="av" name="car" autocomplete="off" placeholder="e.g. Honda City · KA01 AB 1234">
        </div>
      </div>
      ` : ''}

      <!-- Submit Action Button -->
      <button type="submit" class="auth-action-btn" ${S.loading ? 'disabled' : ''}>
        <span>${S.loading ? 'Signing in...' : isReg ? 'Create Account' : isAdmin ? 'Access Admin Console' : 'Sign In'}</span>
        ${ic('arrowRight', 18)}
      </button>
      </form>

      <!-- Bottom toggle link -->
      ${!isAdmin ? `
      <div class="auth-bottom-link">
        ${isReg ? 
          `Already have an account? <a href="#" onclick="S.reg=0;S.err='';render();return false">Sign In</a>` : 
          `New to UrbanRide? <a href="#" onclick="S.reg=1;S.err='';render();return false">Create an account</a>`
        }
      </div>
      ` : `
      <div class="auth-bottom-link">
        Commuter or driver? <a href="#" onclick="S.tab='user';S.err='';render();return false">Switch to User Sign In</a>
      </div>
      `}

    </div>
  </div>
  `;
}

function togglePassword(){
  const input=$('ap');
  if(!input)return;
  S.showPw=!S.showPw;
  input.type=S.showPw?'text':'password';
  const icon=$('pw-toggle-icon');
  if(icon)icon.innerHTML=ic(S.showPw?'eyeOff':'eye',18);
  const toggle=input.parentElement.querySelector('.pw-toggle-btn');
  if(toggle)toggle.setAttribute('aria-pressed',String(S.showPw));
}
