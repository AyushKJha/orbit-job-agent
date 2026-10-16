import {initializeLamp} from './lamp.js';

export async function ensureAuth(){
 const status=await (await fetch('/api/auth/me')).json();
 const overlay=document.querySelector('#authOverlay');
 if(!status.hosted){overlay.hidden=true;return;}
 document.querySelector('#logoutButton').hidden=false;
 if(status.user){overlay.hidden=true;return;}

 document.body.classList.add('signed-out');
 const intro=document.querySelector('#introOverlay');
 const video=document.querySelector('#orbitIntroVideo');
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const skipIntro=()=>{
  intro.hidden=true;
  overlay.hidden=false;
  try{localStorage.setItem('orbit-intro-seen-v1','yes')}catch{}
  video.pause();
 };
 function playIntro(){
  overlay.hidden=true;
  intro.hidden=false;
  try{video.currentTime=0}catch{}
  if(!reducedMotion.matches)video.play().catch(()=>{document.querySelector('.intro-video-fallback').hidden=false;});
 }
 document.body.classList.add('signed-out');
 document.querySelector('#skipIntro').addEventListener('click',skipIntro);
 document.querySelector('#enterOrbit').addEventListener('click',skipIntro);
 document.querySelector('#replayIntro').addEventListener('click',playIntro);
 video.addEventListener('error',()=>{video.hidden=true;document.querySelector('.intro-video-fallback').hidden=false;});
 let introSeen=false;try{introSeen=localStorage.getItem('orbit-intro-seen-v1')==='yes'}catch{}
 if(introSeen){intro.hidden=true;overlay.hidden=false;video.pause();}
 else playIntro();

 const cord=document.querySelector('#lampCord');
 const lampVideo=document.querySelector('.lamp-video');
 const lampArt=document.querySelector('.lamp-illustration');
 lampVideo.addEventListener('error',()=>lampArt.classList.add('video-fallback'));
 const card=document.querySelector('#authCard');
 const hint=document.querySelector('#lampHint');
 initializeLamp({overlay,cord,card,hint});

 let signup=false;
 const form=document.querySelector('#authForm'),title=document.querySelector('#authTitle'),submit=document.querySelector('#authSubmit'),toggle=document.querySelector('#authToggle'),error=document.querySelector('#authError');
 toggle.addEventListener('click',()=>{
  signup=!signup;
  title.textContent=signup?'Start your next chapter.':'Welcome back to Orbit.';
  submit.textContent=signup?'Create my workspace':'Sign in';
  toggle.textContent=signup?'Already have an account? Sign in':'New to Orbit? Create an account';
  document.querySelector('#inviteField').hidden=!signup;
  form.elements.password.autocomplete=signup?'new-password':'current-password';
  error.textContent='';
 });
 await new Promise(resolve=>{
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!form.reportValidity())return;
   submit.disabled=true;error.textContent='';
   try{
    const r=await fetch('/api/auth/'+(signup?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    const value=await r.json();
    if(!r.ok)throw Error(value.error||'Sign-in failed. Please check your details.');
    form.reset();overlay.hidden=true;document.body.classList.remove('signed-out');resolve();
   }catch(e){error.textContent=e.message;}
   finally{submit.disabled=false;}
  });
 });
}
