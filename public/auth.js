export async function ensureAuth(){
 const status=await (await fetch('/api/auth/me')).json();
 const overlay=document.querySelector('#authOverlay'),intro=document.querySelector('#introOverlay');
 if(!status.hosted){overlay.hidden=true;intro.hidden=true;return;}
 document.querySelector('#logoutButton').hidden=false;
 if(status.user){overlay.hidden=true;intro.hidden=true;return;}
 document.body.classList.add('signed-out');
 overlay.hidden=true;intro.hidden=false;
 document.querySelector('#introContinue').addEventListener('click',()=>{
  intro.hidden=true;overlay.hidden=false;
  requestAnimationFrame(()=>document.querySelector('#cordHandle').focus({preventScroll:true}));
 });
 let signup=false;
 const form=document.querySelector('#authForm'),title=document.querySelector('#authTitle'),submit=document.querySelector('#authSubmit'),toggle=document.querySelector('#authToggle'),error=document.querySelector('#authError');
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
