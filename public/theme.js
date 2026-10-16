export function toggleTheme(root,storage){
 const next=root.dataset.theme==='ivory'?'midnight':'ivory';
 if(next==='midnight')delete root.dataset.theme;
 else root.dataset.theme=next;
 try{storage.setItem('orbit-theme',next==='ivory'?'ivory':'midnight');}catch{}
 return next;
}
