# Ângulo — PWA local de seleção de quadros (v1.1.0)

PWA em pt-BR que abre vídeos **no próprio aparelho**, encontra quadros tecnicamente interessantes e exporta JPEG. Não há upload, API, CDN ou servidor de processamento.

## Uso

```bash
cd /home/daytona/workspace/angulo-pwa
python3 -m http.server 8080
```

Abra `http://localhost:8080`. A instalação Android/Chrome depende do botão **Instalar** aparecer no navegador. A prévia única `../angulo-web.html` não tem manifesto nem Service Worker; ela serve para abrir/compartilhar como HTML independente.

## v1.1.0 — arquivos locais grandes e até 30 minutos

- Seleção usa somente `URL.createObjectURL(file)` e `<video preload="metadata">`; **não** usa `FileReader`, base64 nem `arrayBuffer()` do vídeo inteiro.
- O feedback imediato é **“Abrindo arquivo local, sem upload”**. Metadados e controles ficam disponíveis assim que o navegador entrega `loadedmetadata`; isso depende da leitura do container e do decoder, portanto não é prometido como instantâneo.
- Os listeners de `loadedmetadata`, `error` e `abort` são registrados antes de associar a URL ao vídeo. A abertura tem timeout de **30 s** com mensagem acionável.
- Aceita duração finita até **1800,5 s** (30:00 com tolerância de 0,5 s). Quando WebM retorna duração `Infinity`, a aplicação tenta o seek de descoberta usado por navegadores e só libera análise quando obtém duração finita válida.
- Não há teto arbitrário de MB. Em arquivos acima de 500 MB a interface avisa que a abertura/seek depende do codec, índice e hardware do aparelho.
- Amostragem é independente da duração: **60** amostras por padrão, opção **24** muito rápida e 120 detalhada. A análise usa canvas máximo de 360 px de largura e cede o loop ao navegador entre amostras.
- Miniaturas usam canvas máximo de 480 px e JPEG compacto. O JPEG na resolução original só é criado ao tocar em **JPEG original**, evitando manter exportações full-resolution gigantes em memória.
- A análise pode ser cancelada: `AbortController` cancela espera de seek; os listeners e timers são removidos.

## Recursos

- Abrir pelo seletor ou arrastar/soltar, com controles nativos do vídeo.
- Ranking local por nitidez (Laplaciano), contraste, exposição, faixa útil e diversidade visual (aHash 8×8).
- Galeria, favoritos, captura manual e exportação de JPEGs individuais.
- URLs de Blob de miniaturas são revogadas ao limpar, trocar arquivo ou fechar.
- Manifesto, ícones e Service Worker para o pacote PWA. Cache: `angulo-v1.1.0`.

## Limites honestos

A compatibilidade é do navegador/dispositivo: MP4 H.264/AAC costuma ser a opção mais ampla; WebM depende de suporte de codec/container. Vídeos com índice/metadados defeituosos, codecs não suportados ou armazenamento lento podem falhar ou demorar. O app não envia o vídeo, mas o navegador pode precisar ler partes do arquivo local para localizar metadados e posições de seek.

A seleção é uma análise técnica, não entende pessoas/cenas nem decide intenção criativa. A exportação original pode consumir bastante memória em vídeos de resolução muito alta; por isso é sob demanda.

## Testes executados nesta entrega

- `node --check app.js` e `node --check analysis.js`: aprovados.
- Varredura de `app.js` e da prévia: nenhum uso de `FileReader`, `readAs*` ou `arrayBuffer(`.
- Inspeção de ordem: o `waitEvent(video, 'loadedmetadata', ...)` é criado antes de `setAttribute('s'+'rc', mediaUrl)`.
- Teste real executado pelo pai com `python3 test-angulo-final.py`, Chromium headless via CDP e a aba correta: o fixture `long-moov-end.mp4` (MP4 H.264 com `moov` no fim) tem **2.089.499 bytes**, duração **1800 s**, e abriu com `workspace: true`, informação **`30:00 · 160×90`** e status **`Pronto`** após **2014 ms**. Essa medida usa polling de 2 s; não representa a latência real de abertura nem afirma que abriu exatamente em 2 s.
- Aviso de publicação Pages: houve `assets_missing4`, embora a prévia única não tenha tags de recursos externos reais (CSS e JavaScript estão inline). Possível causa a investigar: sanitização/interpretação de atributos com valores entre aspas pelo publicador. O aviso foi registrado; não bloqueia o pacote PWA nem esta prévia local.

## Estrutura

- `index.html` — interface PWA.
- `style.css` — estilos responsivos.
- `analysis.js` — métricas e ranking local.
- `app.js` — abertura local, duração, análise cancelável, exportação e galeria.
- `sw.js` — cache offline do PWA.
- `../angulo-web.html` — prévia HTML única, sem PWA/SW.
