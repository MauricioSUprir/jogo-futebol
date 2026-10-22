# Formato de cada clube (um arquivo <slug>.json nesta pasta)

{
  "clube": "Flamengo",              // nome como no TM
  "chave": "br/Flamengo",           // "br/<nome do TM>"
  "temporada": "2026",              // a do uniforme em uso em outubro de 2026
  "fornecedor": "texto só informativo (NÃO vai para o desenho)",
  "casa":     UNIFORME,
  "fora":     UNIFORME,
  "terceira": UNIFORME ou null,     // só se lançada e usada em 2026
  "goleiro":  UNIFORME,             // o principal do goleiro (o mais usado)
  "goleiro2": UNIFORME ou null,
  "confianca": "alta" | "media" | "baixa",
  "notas": "o que ficou incerto"
}

UNIFORME = {
  "nome": "Camisa 1 2026",
  "lancamento": "AAAA-MM-DD",       // data do lançamento oficial
  "camisa": "#rrggbb",              // cor de fundo do tronco
  "padrao": "liso" | "listras_verticais" | "listras_horizontais" | "faixa_diagonal" | "faixa_horizontal_peito" | "metades" | "xadrez" | "degrade" | "grafismo",
  "padrao_cores": ["#rrggbb", ...], // cores das listras/faixa/grafismo, na ordem a partir do centro do peito (vazio no liso)
  "padrao_n": 0,                    // nº de listras de cor VISÍVEIS na frente (listras/aros); 0 se não se aplica
  "padrao_largura": 0.0,            // largura da listra/faixa ÷ largura do tronco (frente), aproximado
  "padrao_desc": "descrição curta do desenho, ex.: aros vermelhos e pretos de mesma largura; faixa diagonal do ombro esquerdo",
  "mangas": "#rrggbb",              // cor principal das mangas (pode ser a mesma do tronco)
  "mangas_padrao": "igual_tronco" | "liso" | "outra",
  "punhos": "#rrggbb",
  "gola": { "tipo": "redonda" | "v" | "polo" | "careca_alta" | "transpassada", "cor": "#rrggbb" },
  "ombros": "#rrggbb ou null",      // recorte/faixa nos ombros, se houver
  "laterais": "#rrggbb ou null",    // painéis laterais, se houver
  "numero_cor": "#rrggbb",          // cor dos números das costas
  "calcao": "#rrggbb", "calcao_detalhe": "#rrggbb ou null",
  "meiao": "#rrggbb", "meiao_detalhe": "#rrggbb ou null", "meiao_desc": "ex.: preto com duas faixas brancas no alto",
  "fontes": ["url da notícia/loja oficial", "..."]   // ≥ 2, de preferência o site do clube e um site de uniformes (ex.: Mantos do Futebol, Footy Headlines, Show de Camisas)
}
