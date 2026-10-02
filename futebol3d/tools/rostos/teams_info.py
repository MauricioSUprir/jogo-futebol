import json, subprocess, os
def times():
    out = subprocess.check_output(['node', '-e', "import('../../js/teams.js').then(T=>console.log(JSON.stringify(T.TEAMS.map(t=>t.players.length))))"], cwd=os.path.dirname(os.path.abspath(__file__)))
    return list(enumerate(json.loads(out)))
