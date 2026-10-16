export async function ensureAuth(){const status=await (await fetch('/api/auth/me')).json();const overlay=document.querySelector('#authOverlay');if(!status.hosted){overlay.hidden=true;return;}document.querySelector('#logoutButton').hidden=false;if(status.user){overlay.hidden=true;return;}overlay.hidden=false;document.body.classList.add('signed-out');
const motionAllowed=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lampFrame=0;
if(motionAllowed){
 overlay.addEventListener('pointerenter',()=>overlay.dataset.lit='true');
 overlay.addEventListener('pointerleave',()=>{overlay.dataset.lit='false';overlay.style.setProperty('--lamp-focus','50% 48%');});
 overlay.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  if(lampFrame)cancelAnimationFrame(lampFrame);
  lampFrame=requestAnimationFrame(()=>{
   const rect=overlay.getBoundingClientRect();
   const x=Math.max(12,Math.min(88,((event.clientX-rect.left)/rect.width)*100));
   const y=Math.max(12,Math.min(88,((event.clientY-rect.top)/rect.height)*100));
   overlay.style.setProperty('--lamp-focus',x+'% '+y+'%');
  });
 });
}
formFocus();
function formFocus(){
 const form=document.querySelector('#authForm');
 form.addEventListener('focusin',()=>overlay.dataset.lit='true');
 form.addEventListener('focusout',event=>{if(!form.contains(event.relatedTarget))overlay.dataset.lit='false';});
}
let signup=false;const form=document.querySelector('#authForm'),title=document.querySelector('#authTitle'),submit=document.querySelector('#authSubmit'),toggle=document.querySelector('#authToggle'),error=document.querySelector('#authError');toggle.addEventListener('click',()=>{signup=!signup;title.textContent=signup?'Start your next chapter.':'Welcome back to Orbit.';submit.textContent=signup?'Create my workspace':'Sign in';toggle.textContent=signup?'Already have an account? Sign in':'New to Orbit? Create an account';document.querySelector('#inviteField').hidden=!signup;form.elements.password.autocomplete=signup?'new-password':'current-password';});await new Promise(resolve=>{form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;error.textContent='';try{const r=await fetch('/api/auth/'+(signup?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))}),value=await r.json();if(!r.ok)throw Error(value.error);form.reset();overlay.hidden=true;document.body.classList.remove('signed-out');resolve();}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}});});}
