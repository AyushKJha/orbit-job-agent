export function setLampState({overlay,cord,card,hint},isOn){
 const on=Boolean(isOn);
 overlay.dataset.lamp=on?'on':'off';
 cord.setAttribute('aria-pressed',String(on));
 cord.setAttribute('aria-label',on?'Turn lamp off':'Turn lamp on');
 card.setAttribute('aria-hidden',String(!on));
 card.inert=!on;
 hint.textContent=on?'Your Orbit workspace is ready. Pull again to switch off.':'Pull the cord to switch on your light.';
 return on;
}

export function initializeLamp(elements){
 let on=false;
 const update=next=>{on=setLampState(elements,next);};
 elements.cord.addEventListener('click',()=>update(!on));
 elements.cord.addEventListener('pointerdown',event=>{
  elements.cord.classList.add('is-pulling');
  if(event.pointerType!=='mouse')elements.cord.setPointerCapture?.(event.pointerId);
 });
 for(const eventName of ['pointerup','pointercancel','lostpointercapture'])elements.cord.addEventListener(eventName,()=>elements.cord.classList.remove('is-pulling'));
 elements.cord.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&on){event.preventDefault();update(false);elements.cord.focus();}
 });
 update(false);
 return {get isOn(){return on;},turnOff(){update(false);}};
}
