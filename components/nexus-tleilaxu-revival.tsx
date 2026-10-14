'use client';

import {useState} from 'react';
import type {Action,GameView} from '@/game/engine';
import {nexusTleilaxuRevivalAction} from '@/game/nexus-tleilaxu-options';
import {Button} from './ui/button';

export function NexusTleilaxuRevival({game,act,busy}:{game:GameView;act:(action:Action)=>void;busy:boolean}) {
  const [selected,setSelected]=useState('');
  const [amount,setAmount]=useState(0);
  const [elite,setElite]=useState(0);
  const offer=game.nexusTleilaxu?.secretAlly;
  if(!offer)return null;
  const leader=offer.leaders.some(candidate=>candidate.id===selected)?selected:offer.leaders[0]?.id??'';
  const action=nexusTleilaxuRevivalAction(game,offer.event,leader,amount,elite);
  return <section aria-label="Tleilaxu Nexus Secret Ally revival" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
    <h4>Tleilaxu Secret Ally</h4>
    <p className="fine">Return one own leader free and up to five physical forces at one bank spice each. The leader is required; zero forces is legal. The shared ordinary force allowance and one-leader slot apply.</p>
    {offer.blocked?<p className="notice">{offer.blocked}</p>:<>
      <label className="block space-y-1"><span>Free own leader</span>
        <select aria-label="Free own leader" className="min-h-11 w-full" value={leader} disabled={busy} onChange={event=>setSelected(event.target.value)}>
          {offer.leaders.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.kind==='kwisatz'?' · Kwisatz':''}</option>)}
        </select>
      </label>
      <label className="block space-y-1"><span>Paid physical forces</span>
        <input aria-label="Paid physical forces" type="number" className="min-h-11 w-full" min={0} max={offer.maxForces} value={amount} disabled={busy} onChange={event=>setAmount(Number(event.target.value))}/>
      </label>
      {offer.maxElite>0&&<label className="block space-y-1"><span>Elite forces included</span>
        <input aria-label="Elite forces included" type="number" className="min-h-11 w-full" min={0} max={Math.min(amount,offer.maxElite)} value={elite} disabled={busy} onChange={event=>setElite(Number(event.target.value))}/>
      </label>}
      <p className="fine">Bank payment: {amount} spice. Leader payment: 0. Returned forces retain their actual normal/elite identities.</p>
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy||!action} onClick={()=>{if(!busy&&action)act(action)}}>Use Tleilaxu Secret Ally</Button>
    </>}
    <details><summary className="min-h-11 cursor-pointer py-2">Provisional revival interpretation</summary><p className="fine">{offer.policy}</p></details>
  </section>;
}
