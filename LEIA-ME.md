# Biblioteca da Sarah (modelos 3D da voz)

Abrir: `index.html` (biblioteca). Cada modelo é um .html carregado dentro dela.

- `index.html`: biblioteca + barra do topo. Lista `MODELOS` no script: pra adicionar modelo, crie o .html e acrescente uma linha.
- `ui.css`: estilo comum (cores, painéis, botões, card).
- `laringe.html`: GERADO. Editar `tools/laringe.template.html` (HTML/CSS) e `tools/app.js` (3D), depois rodar `python3 tools/build.py`.
- `modelo.js`: malhas do BodyParts3D convertidas (`tools/converter.py` a partir de `modelo-original/`). Licença CC BY-SA 2.1 JP, crédito obrigatório no rodapé.
- `camadas.html`: 5 camadas da prega vocal + ciclo glótico (`?modo=ciclo`).
- Parâmetros de teste: `?limpo=1` (só o 3D, pra miniatura), `sel=<parte>`, `pose=`, `v=`, `cut=`, `so=a,b`.
- Miniaturas: `art/thumbs/`.
- `respiracao.html` + `resp-modelo.js`: sistema respiratório. Gerado por `tools/converter_resp.py` a partir das peças do BodyParts3D (baixadas no scratchpad; não ficam na pasta). Pulmões são gerados pelo script (o banco não tem a superfície deles). Cenas: `?cena=ciclo|apoio|tipos|desInsp|desExp`, `pausa=1&p=0.3` congela num ponto do ciclo.
