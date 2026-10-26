# Changelog

## 1.1.0 — 2026-10-26

### Corrigido e melhorado
- Abertura de vídeo agora mostra imediatamente “Abrindo arquivo local, sem upload”.
- Registra eventos de metadados/erro/abort antes da URL local ser definida e aplica timeout acionável de 30 segundos.
- Trata duração `Infinity` de WebM tentando descoberta de duração por seek e exige duração finita antes da análise.
- Limite de duração passa a aceitar até 1800,5 s; não há limite arbitrário de tamanho em MB.
- Padrão de análise alterado para 60 amostras; 24 é modo muito rápido e 120 detalhado.
- Análise reduzida a canvas de 360 px; miniaturas a 480 px; JPEG full-resolution é exportado somente sob demanda.
- Cancelamento durante seek passou a usar `AbortController`; loops cedem execução entre amostras.
- Miniaturas e mídia local continuam em `objectURL`; nenhum vídeo inteiro é lido por FileReader/base64/arrayBuffer.
- Prévia `angulo-web.html` foi recriada como HTML único sem manifesto/Service Worker.
- Atualizado cache do Service Worker para `angulo-v1.1.0`.

### Testes
- Sintaxe JavaScript validada com Node.
- Sem APIs de leitura integral de vídeo na implementação.
- Fixture MP4 H.264 de 30:00 confirmado por ffprobe; o teste de interação em Chromium headless ficou pendente por timeout do sandbox.
