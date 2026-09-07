"""Convert the MIT-licensed Truthsayer geometry; see THIRD_PARTY_NOTICES.md."""
import json, math
from pathlib import Path
src=json.load(open('/tmp/dune-config.json'))['generated']
rocks={'false_wall_south','false_wall_east','false_wall_west','shield_wall','pasty_mesa','sihaya_ridge','hole_in_the_rock','rim_wall_west','harg_pass'}
strongholds={'arrakeen','carthag','tueks_sietch','sietch_tabr','habbanya_ridge_sietch'}
rename={'habbanya_ridge_sietch':'Habbanya Sietch','tueks_sietch':"Tuek’s Sietch"}
result=[]
for id,sectors in src['location_regions'].items():
 if id=='arrakis':continue
 pts=src['territories']['polygons'][id]
 result.append({'id':id,'name':rename.get(id,id.replace('_',' ').title()),'sectors':[0] if id=='polar_sink' else sorted(int(x[1:]) for x in sectors),'type':'polar' if id=='polar_sink' else 'stronghold' if id in strongholds else 'rock' if id in rocks else 'sand','points':pts,'center':[round(sum(p[i] for p in pts)/len(pts),1) for i in range(2)],'neighbors':sorted(set(b if a==id else a for a,b in src['neighbors'] if (a==id or b==id) and a!='arrakis' and b!='arrakis'))})
Path('game/board-data.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
graph={}
for id,entries in src['neighborhoods'].items():
 if id=='arrakis':continue
 if id=='polar_sink':
  graph['polar_sink:0']=sorted(set(f'{dest}:{int(sec[1:])}' for entry in entries.values() for dest,secs in entry.items() if dest not in ('arrakis','polar_sink') for sec in secs))
 else:
  for sec,entry in entries.items():
   key=f'{id}:{int(sec[1:])}'
   graph[key]=sorted(set('polar_sink:0' if dest=='polar_sink' else f'{dest}:{int(s[1:])}' for dest,secs in entry.items() if dest!='arrakis' for s in secs if dest!=id or s!=sec))
# Enforce symmetric board edges. The source approximates connectivity geometrically;
# printed-board verification remains required before claiming full compliance.
for a,edges in list(graph.items()):
 for b in edges:
  if b in graph and a not in graph[b]:graph[b].append(a)
Path('game/board-graph.json').write_text(json.dumps(graph,separators=(',',':'))+'\n')
Path('THIRD_PARTY_NOTICES.md').write_text('Board geometry and connectivity adapted from https://github.com/marekyggdrasil/truthsayer (main). No raster artwork is included.\n\n'+Path('/tmp/truthsayer-license').read_text())
