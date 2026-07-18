import type { World } from "./types";
import { LOCATION_DEFS } from "./types";

const mapped = (w: World, kind: string) => w.player.operatingRooms?.filter((r) => r.kind === kind) ?? [];

export function pmCapacity(w: World): number {
  const rooms = mapped(w, "office");
  if (rooms.length) return rooms.filter(r => r.team === "product" || r.team === "unassigned").reduce((a,r)=>a+r.capacity,0);
  return w.player.locations.filter(l=>l.type==="office").reduce((a,l)=>a+LOCATION_DEFS.office.tiers[l.tier].capacity,0);
}

export function warehouseUnitCapacity(w: World): number {
  const rooms = mapped(w, "warehouse");
  return rooms.length ? rooms.reduce((a,r)=>a+r.capacity,0) : w.player.locations.filter(l=>l.type==="warehouse").reduce((a,l)=>a+LOCATION_DEFS.warehouse.tiers[l.tier].capacity*10_000,0);
}

export function warehouseCapacity(w: World): number {
  return Math.max(0, Math.floor(warehouseUnitCapacity(w) / 10_000));
}

export function factoryCapacity(w: World): { onshore:number; offshore:number; total:number } {
  const rooms = mapped(w, "factory");
  if (rooms.length) { const total=rooms.reduce((a,r)=>a+r.capacity,0); return {onshore:total,offshore:0,total}; }
  let onshore=0, offshore=0;
  for (const l of w.player.locations) {
    if(l.type==="factory_onshore") onshore+=LOCATION_DEFS.factory_onshore.tiers[l.tier].capacity;
    if(l.type==="factory_offshore") offshore+=LOCATION_DEFS.factory_offshore.tiers[l.tier].capacity;
  }
  return {onshore,offshore,total:onshore+offshore};
}

export function outsourcingCapacity(w: World): number { return mapped(w,"outsourcing").reduce((a,r)=>a+r.capacity,0); }
export function inventoryUsed(w: World): number { return w.player.skus.reduce((a,s)=>a+s.inventory+s.mfgBatchSize,0); }

export function pmAssignments(w: World) {
  const pms=w.player.personnel.filter(p=>p.role==="product_manager");
  return pms.map((pm,i)=>{ const assigned=w.player.skus.filter((_,si)=>si%Math.max(1,pms.length)===i).map(s=>s.name); return {pmId:pm.id,products:assigned,available:Math.max(0,2-assigned.length)}; });
}

export function canCreateProduct(w: World): {ok:boolean;reason:string} {
  const productRooms=mapped(w,"office").filter(r=>r.team==="product");
  if(!productRooms.length) return {ok:false,reason:"Build an office and assign it to Product Management."};
  const pms=w.player.personnel.filter(p=>p.role==="product_manager");
  if(!pms.length) return {ok:false,reason:"Hire a Product Manager and assign them to a Product Management office."};
  const seated=new Set(productRooms.flatMap(r=>r.assignedPersonnelIds));
  const eligible=pms.filter(p=>seated.has(p.id));
  if(!eligible.length) return {ok:false,reason:"Assign a Product Manager to a Product Management office."};
  const locked=new Set(w.player.skus.filter(s=>s.status==="designing"&&s.assignedPmId).map(s=>s.assignedPmId));
  if(!eligible.some(p=>!locked.has(p.id))) return {ok:false,reason:"All assigned Product Managers are busy designing products."};
  return {ok:true,reason:""};
}

export function canProduce(w: World, qty:number, unitCost:number, method:"own"|"outsource"="outsource"):{ok:boolean;reason:string}{
  const cost=qty*unitCost;
  if(w.player.cash<cost) return {ok:false,reason:`Not enough cash (need ${Math.round(cost).toLocaleString()}).`};
  const free=Math.max(0,warehouseUnitCapacity(w)-inventoryUsed(w));
  if(qty>free) return {ok:false,reason:`Warehouse capacity shortfall: ${Math.round(free).toLocaleString()} units free.`};
  const cap=method==="own"?factoryCapacity(w).total:outsourcingCapacity(w);
  if(cap<=0) return {ok:false,reason:method==="own"?"Build a factory for owned manufacturing.":"Build a Sourcing Office to manage outsourced production."};
  if(qty>cap) return {ok:false,reason:`Batch exceeds monthly ${method==="own"?"factory":"supplier"} capacity of ${cap.toLocaleString()} units.`};
  return {ok:true,reason:""};
}
