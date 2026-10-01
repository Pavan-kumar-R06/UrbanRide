/* ========================================================================= */
/* CITY GRAPH & ROUTING ALGORITHM                                            */
/* ========================================================================= */
const P={ec:['Electronic City',18,88],hsr:['HSR Layout',33,74],kor:['Koramangala',42,60],jay:['Jayanagar',22,52],mg:['MG Road',52,42],ind:['Indiranagar',64,46],mar:['Marathahalli',77,54],wf:['Whitefield',87,42],mal:['Malleshwaram',38,30],ya:['Yeshwanthpur',24,22],heb:['Hebbal',50,10]};
const E=[['ec','hsr'],['hsr','kor'],['kor','jay'],['kor','mg'],['jay','mg'],['mg','ind'],['ind','mar'],['mar','wf'],['mg','mal'],['mal','ya'],['mal','heb'],['ya','heb'],['kor','ind'],['hsr','mar']];
const d=(a,b)=>Math.hypot(P[a][1]-P[b][1],P[a][2]-P[b][2]);
function route(a,b){
  const D={[a]:0},pr={},q=new Set(Object.keys(P));
  while(q.size){
    let u=null;
    q.forEach(k=>{if(D[k]!==undefined&&(u===null||D[k]<D[u]))u=k});
    if(u===null||u==b)break;
    q.delete(u);
    E.forEach(([x,y])=>{
      const v=x==u?y:y==u?x:null;
      if(v&&q.has(v)){
        const n=D[u]+d(u,v);
        if(D[v]===undefined||n<D[v]){D[v]=n;pr[v]=u}
      }
    });
  }
  const p=[b];
  while(p[0]!=a&&pr[p[0]])p.unshift(pr[p[0]]);
  return p;
}
const rt3=(a,v,b)=>v&&v!=a&&v!=b?route(a,v).concat(route(v,b).slice(1)):route(a,b);
const km=(p,i,j)=>{let s=0;for(let k=i;k<j;k++)s+=d(p[k],p[k+1]);return +(s*.3).toFixed(1)};
const near=(p,l)=>{let bi=0,bd=1e9;p.forEach((x,i)=>{let v=d(x,l);if(v<bd){bd=v;bi=i}});return[bi,bd]};

/* ONE price formula used everywhere: fare per seat = km travelled x driver rate per km.
   A platform fee (if any) is calculated separately and shown as its own line. */
const PLATFORM_FEE_PCT=0; // set e.g. 5 to charge a separate 5% platform fee on top of the fare
const priceFor=(k,rate,seats=1)=>{
  const perSeat=Math.max(1,Math.round(k*rate)),base=perSeat*seats,fee=Math.round(base*PLATFORM_FEE_PCT/100);
  return{k,perSeat,seats,base,fee,total:base+fee};
};