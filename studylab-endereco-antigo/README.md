# MindTrack AI — o endereço antigo

O app MindTrack AI está no ar em **https://mindtrack-ai-ws6c.onrender.com/** (site estático no Render, que
baixa a pasta `studylab/` deste repositório no commit escolhido em `APP_COMMIT`).

Esta pasta é o que o GitHub Pages publica em `/studylab/` (ver `.github/scripts/montar-site.sh`): só o
redirecionamento do link antigo — `index.html` leva os dados de estudo junto pelo `#migrar=` e `sw.js` desliga o
app antigo nos celulares. O **servidor** fica em `studylab-server/`, também publicado no Render.
