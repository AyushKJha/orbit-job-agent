export async function ensureAuth(){
 const status=await (await fetch('/api/auth/me')).json();
 const overlay=document.querySelector('#authOverlay'),intro=document.querySelector('#introOverlay');
 const preview=new URLSearchParams(location.search).get('preview')==='experience';
 if(!status.hosted&&!preview){overlay.hidden=true;intro.hidden=true;return;}
 document.querySelector('#logoutButton').hidden=false;
 if(status.user&&!preview){overlay.hidden=true;intro.hidden=true;return;}
 document.body.classList.add('signed-out');
 overlay.hidden=true;intro.hidden=false;
 let introTimer;
 const enterSignIn=()=>{clearTimeout(introTimer);intro.classList.add('is-exiting');setTimeout(()=>{intro.hidden=true;intro.classList.remove('is-exiting');overlay.hidden=false;window.orbitSetLamp?.(false);},500);};
 introTimer=setTimeout(enterSignIn,matchMedia('(prefers-reduced-motion: reduce)').matches?1200:4200);
 let signup=false;
 const form=document.querySelector('#authForm'),title=document.querySelector('#authTitle'),submit=document.querySelector('#authSubmit'),toggle=document.querySelector('#authToggle'),error=document.querySelector('#authError');
 if(preview){
  form.querySelectorAll('input').forEach(input=>{input.readOnly=true;input.placeholder=input.name==='handle'?'Username preview':'Password preview';});
  submit.disabled=true;submit.textContent='Preview only';toggle.hidden=true;error.textContent='This is a visual preview. Sign out to use your real login.';
 }
 toggle.addEventListener('click',()=>{
  signup=!signup;
  title.innerHTML=signup?'Start your next chapter.<em>Make it yours.</em>':'Welcome back.<em>Your next chapter awaits.</em>';
  submit.innerHTML=signup?'Create my workspace <span aria-hidden="true">↗</span>':'Sign in <span aria-hidden="true">↗</span>';
  toggle.textContent=signup?'Already have an account? Sign in':'New to Orbit? Create an account';
  document.querySelector('#inviteField').hidden=!signup;
  form.elements.password.autocomplete=signup?'new-password':'current-password';
 });
 await new Promise(resolve=>{
  form.addEventListener('submit',async e=>{
   e.preventDefault();submit.disabled=true;error.textContent='';
   try{
    const r=await fetch('/api/auth/'+(signup?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))}),value=await r.json();
    if(!r.ok)throw Error(value.error);
    form.reset();overlay.hidden=true;document.body.classList.remove('signed-out');resolve();
   }catch(e){error.textContent=e.message;}
   finally{submit.disabled=false;}
  });
 });
}
