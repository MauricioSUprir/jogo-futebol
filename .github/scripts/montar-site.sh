#!/usr/bin/env bash
# Monta o site do Pages em _site (usado pelos dois deploys de deploy-pages.yml). GOLACO=novo publica o golaco/ deste
# commit (os testes dele passaram); qualquer outro valor publica o golaco do último deploy aprovado (o que já está no ar).
# Precisa do GH_TOKEN (gh run list) e do histórico do git (git archive do commit aprovado).
set -euo pipefail
GOLACO="${1:-aprovado}"
# Total Match continua na raiz do site.
rm -rf _site
mkdir -p _site
cp -r legacy-total-match/. _site/
# ferramentas do Total Match (geradores, capas originais) não vão para o site
rm -rf _site/ferramentas
# App de Finanças de Casa fica em /financas-casa/
mkdir -p _site/financas-casa
cp -r financas-casa/. _site/financas-casa/
# LookLab (estilista digital) fica em /looklab/
mkdir -p _site/looklab
cp -r looklab/. _site/looklab/
# StudyLab fica em /studylab/
mkdir -p _site/studylab
cp -r studylab/. _site/studylab/
# KATSEYE Central fica em /katseye-central/
mkdir -p _site/katseye-central
cp -r katseye-central/. _site/katseye-central/
# Jezero (sobrevivência em Marte) fica em /marte/
mkdir -p _site/marte
cp -r marte/. _site/marte/
rm -rf _site/marte/tools
# GOLAÇO (futebol 3D) fica em /futebol3d/
mkdir -p _site/futebol3d
cp -r futebol3d/. _site/futebol3d/
rm -rf _site/futebol3d/tools
# GOLAÇO novo (futebol 3D, projeto do zero) fica em /golaco/
mkdir -p _site/golaco
if [ "$GOLACO" = "novo" ]; then
  cp -r golaco/. _site/golaco/
else
  # testes do golaco reprovados, pulados (igual ao aprovado) ou ainda rodando (a publicação rápida): publica o golaco
  # do último deploy que deu certo (o mesmo que já estava no ar)
  BOM=$(gh run list --workflow deploy-pages.yml --branch main --status success --limit 1 --json headSha --jq '.[0].headSha')
  if [ -z "$BOM" ]; then echo "Nenhum deploy aprovado encontrado para o golaco"; exit 1; fi
  echo "golaco fica na versão de $BOM ($GOLACO)"
  mkdir -p _site_golaco_tmp && git archive "$BOM" golaco | tar -x -C _site_golaco_tmp
  cp -r _site_golaco_tmp/golaco/. _site/golaco/
  rm -rf _site_golaco_tmp
fi
rm -rf _site/golaco/tools
# Céu do Rio (simulador de voo) fica em /aviao/
mkdir -p _site/aviao
cp -r aviao/. _site/aviao/
rm -rf _site/aviao/tools
# RELÂMPAGO (corrida 3D em supervelocidade) fica em /velocista/
mkdir -p _site/velocista
cp -r velocista/. _site/velocista/
rm -rf _site/velocista/tools
# THE FLASH: versão do deploy, para o jogo se atualizar sozinho (velocista/js/atualizar.js)
echo "{\"v\": \"${GITHUB_SHA}\"}" > _site/velocista/versao.json
# LANCE A LANCE (simulador de partidas) fica em /simulador/
mkdir -p _site/simulador
cp -r simulador/. _site/simulador/
rm -rf _site/simulador/tools
