export var SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
export function sup(n){ return String(n).split('').map(function(c){return SUP[c]||c;}).join(''); }
export function num(x){
  if(x>=100) return Math.round(x).toLocaleString('ko-KR');
  if(x>=10) return x.toFixed(1).replace(/\.0$/,'');
  return x.toFixed(2).replace(/0$/,'').replace(/\.0$/,'');
}
export var LY=9.4607e15, AUm=1.496e11;
export function plainLength(m){
  if(m>=.1*LY){ var ly=m/LY; if(ly>=1e8) return num(ly/1e8)+'억 광년'; if(ly>=1e4) return num(ly/1e4)+'만 광년'; return num(ly)+' 광년'; }
  if(m>=AUm) return num(m/AUm)+' AU';
  if(m>=1e3) return num(m/1e3)+' km';
  if(m>=1) return num(m)+' m';
  if(m>=1e-2) return num(m*100)+' cm';
  if(m>=1e-3) return num(m*1e3)+' mm';
  if(m>=1e-6) return num(m*1e6)+' μm';
  if(m>=1e-9) return num(m*1e9)+' nm';
  if(m>=1e-12) return num(m*1e12)+' pm';
  if(m>=1e-15) return num(m*1e15)+' fm';
  return '양성자의 10'+sup(Math.round(Math.log10(1.7e-15/m)))+'분의 1';
}
