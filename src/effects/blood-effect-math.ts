export type DamageImpactKind="projectile"|"melee"|"fire"|"other";
export interface DamageImpactContext{kind:DamageImpactKind;damage:number;hitX:number;hitY:number;directionX:number;directionY:number;weaponId?:string;sequence:number;killed?:boolean}
export type BloodParticleRole="impact"|"streak"|"droplet";
export type BloodEffectProfile="pistol"|"smg"|"shotgun"|"rifle"|"projectile"|"melee";
export interface BloodParticlePlan{x:number;y:number;velocityX:number;velocityY:number;lifetimeMs:number;size:1|2;tailLength:number;travelDistance:number;angle:number;role:BloodParticleRole}
export interface BloodDecalPlan{x:number;y:number;radius:number;directionX:number;directionY:number;profile:BloodEffectProfile;sequence:number}
export interface BloodEffectPlan{profile:BloodEffectProfile;particles:BloodParticlePlan[];decal:BloodDecalPlan}

interface ProjectileTuning{profile:Exclude<BloodEffectProfile,"melee">;impactCount:number;streakCount:number;dropletCount:number;spread:number;dropletSpread:number;minimum:number;maximum:number;damageScale:number}

export function createBloodEffectPlan(context:DamageImpactContext):BloodEffectPlan{
  let dx=context.directionX,dy=context.directionY;const directionLength=Math.hypot(dx,dy);if(directionLength>0){dx/=directionLength;dy/=directionLength;}else{dx=1;dy=0;}
  const baseAngle=Math.atan2(dy,dx);const seed=mixSeed(context);const projectile=context.kind==="projectile";
  if(!projectile)return createMeleePlan(context,seed,dx,dy,baseAngle);
  const tuning=getProjectileTuning(context.weaponId);const particles:BloodParticlePlan[]=[];
  const damageBonus=Math.min(3,Math.floor(Math.max(0,context.damage-20)/28));
  const primaryLength=clamp(tuning.minimum+context.damage*tuning.damageScale,tuning.minimum,tuning.maximum);
  for(let index=0;index<tuning.impactCount;index++){
    const angle=baseAngle+(random(seed,index*5)-.5)*2.5;const travel=2+random(seed,index*5+1)*4;
    particles.push(particle(context,angle,travel,50+random(seed,index*5+2)*40,index%3===0?2:1,1+index%3,"impact"));
  }
  const streakCount=tuning.streakCount+damageBonus;
  for(let index=0;index<streakCount;index++){
    const fan=(index/(Math.max(1,streakCount-1))-.5)*tuning.spread;const angle=baseAngle+fan+(random(seed,70+index*3)-.5)*tuning.spread*.28;
    const travel=primaryLength*(.52+random(seed,71+index*3)*.48);const lifetime=190+random(seed,72+index*3)*180;
    particles.push(particle(context,angle,travel,lifetime,index%5===0?2:1,Math.max(3,Math.round(travel/5)),"streak"));
  }
  const dropletCount=Math.min(18,tuning.dropletCount+damageBonus+(context.killed?2:0));
  for(let index=0;index<dropletCount;index++){
    const angle=baseAngle+(random(seed,130+index*3)-.5)*tuning.dropletSpread;const travel=3+random(seed,131+index*3)*Math.min(17,primaryLength*.5);const lifetime=230+random(seed,132+index*3)*240;
    particles.push(particle(context,angle,travel,lifetime,index%4===0?2:1,index%3===0?2:1,"droplet"));
  }
  const decalDistance=primaryLength*(.48+random(seed,211)*.36);
  return{profile:tuning.profile,particles,decal:{x:context.hitX+dx*decalDistance+(random(seed,212)-.5)*4,y:context.hitY+dy*decalDistance+(random(seed,213)-.5)*4,radius:clamp(2+context.damage/25+(context.killed?1:0),2,6),directionX:dx,directionY:dy,profile:tuning.profile,sequence:context.sequence}};
}

export function aggregateProjectileDamage(contexts:readonly DamageImpactContext[]):DamageImpactContext|undefined{if(!contexts.length)return undefined;let damage=0,dx=0,dy=0,killed=false;for(const context of contexts){damage+=context.damage;dx+=context.directionX*context.damage;dy+=context.directionY*context.damage;killed||=Boolean(context.killed);}return{...contexts[0]!,damage,directionX:dx,directionY:dy,killed};}

function createMeleePlan(context:DamageImpactContext,seed:number,dx:number,dy:number,baseAngle:number):BloodEffectPlan{
  const particles:BloodParticlePlan[]=[];const impactCount=4+(context.killed?2:0);
  for(let index=0;index<impactCount;index++){
    const fan=(index/(Math.max(1,impactCount-1))-.5)*2.7;const angle=baseAngle+fan+(random(seed,index*4)-.5)*.35;const travel=2+random(seed,index*4+1)*7;
    particles.push(particle(context,angle,travel,180+random(seed,index*4+2)*180,index%3===0?2:1,index%2,"impact"));
  }
  const droplets=5+(context.killed?2:0);
  for(let index=0;index<droplets;index++){
    const angle=baseAngle+(random(seed,60+index*3)-.5)*3+Math.PI*.18;const travel=2+random(seed,61+index*3)*9;
    particles.push(particle(context,angle,travel,260+random(seed,62+index*3)*180,index%3===0?2:1,1,"droplet"));
  }
  const decalDistance=random(seed,121)*5;
  return{profile:"melee",particles,decal:{x:context.hitX+dx*decalDistance+(random(seed,122)-.5)*5,y:context.hitY+dy*decalDistance+2+random(seed,123)*4,radius:clamp(2.5+context.damage/28+(context.killed?1:0),2.5,6),directionX:dx,directionY:dy,profile:"melee",sequence:context.sequence}};
}

function particle(context:DamageImpactContext,angle:number,travelDistance:number,lifetimeMs:number,size:number,tailLength:number,role:BloodParticleRole):BloodParticlePlan{
  const durationSeconds=Math.max(.08,lifetimeMs/1000);const speed=travelDistance/(durationSeconds*.72);
  return{x:context.hitX,y:context.hitY,velocityX:Math.cos(angle)*speed,velocityY:Math.sin(angle)*speed,lifetimeMs,size:size===2?2:1,tailLength,travelDistance,angle,role};
}

function getProjectileTuning(weaponId?:string):ProjectileTuning{
  if(weaponId==="smg")return{profile:"smg",impactCount:4,streakCount:4,dropletCount:5,spread:.72,dropletSpread:1.9,minimum:12,maximum:26,damageScale:.42};
  if(weaponId==="shotgun")return{profile:"shotgun",impactCount:7,streakCount:9,dropletCount:14,spread:1.3,dropletSpread:2.55,minimum:18,maximum:42,damageScale:.48};
  if(weaponId==="hunting_rifle")return{profile:"rifle",impactCount:6,streakCount:7,dropletCount:10,spread:.42,dropletSpread:1.55,minimum:26,maximum:54,damageScale:.55};
  if(weaponId==="pistol")return{profile:"pistol",impactCount:6,streakCount:6,dropletCount:9,spread:.88,dropletSpread:2.1,minimum:16,maximum:36,damageScale:.5};
  return{profile:"projectile",impactCount:4,streakCount:5,dropletCount:5,spread:.9,dropletSpread:2,minimum:14,maximum:44,damageScale:.5};
}

function mixSeed(context:DamageImpactContext):number{let seed=context.sequence^Math.imul(Math.round(context.damage*10),0x45d9f3b);for(const character of context.weaponId??context.kind)seed=Math.imul(seed^character.charCodeAt(0),0x27d4eb2d);return seed>>>0;}
function clamp(value:number,minimum:number,maximum:number):number{return Math.min(maximum,Math.max(minimum,value));}
function random(seed:number,salt:number):number{let value=(seed^Math.imul(salt+1,0x9e3779b1))>>>0;value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;return(value>>>0)/0x1_0000_0000;}
