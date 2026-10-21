# Nyx

**Seus slides, em cena.** Solte um PDF ou PPTX e apresente em tela cheia direto do navegador.
Sem conta, sem upload: o arquivo é lido localmente e nunca sai do computador.

🌙 https://hoyasumii.github.io/nyx/

![Nyx](public/og.png)

## Recursos

- **PDF** renderizado com [pdf.js](https://mozilla.github.io/pdf.js/), nítido em qualquer resolução.
- **PPTX** interpretado por um renderizador próprio (`src/deck/pptx`): temas, layouts e masters,
  textos com herança de estilos, marcadores, formas predefinidas e livres, imagens com recorte,
  grupos, tabelas (incluindo os estilos nativos do PowerPoint), fundos sólidos, gradientes e imagens,
  e diagramas SmartArt.
- **Modo apresentação** em tela cheia: o cursor vira um pequeno holofote que clareia o slide
  por trás dele, sem esconder o conteúdo.
- Miniaturas, grade de slides, gestos de toque e atalhos de teclado
  (`→` `Espaço` `←` `Home` `End` `F` `G` `B` `Esc`).

Animações, vídeos e gráficos nativos do PowerPoint não são reproduzidos; para fidelidade total, exporte como PDF.

## Desenvolvimento

```bash
npm install
npm run dev        # servidor local em http://localhost:5173/nyx/
npm test           # testes unitários (vitest)
npm run build      # typecheck + build de produção em dist/
```

### Imagem OpenGraph e ícones

`public/og.png` e os ícones PNG são gerados a partir de `scripts/og/og.html` e `public/logo.svg`:

```bash
npx playwright install chromium   # uma vez
npm run assets                    # ou CHROMIUM_PATH=/caminho/do/chrome npm run assets
```

## Deploy

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`.
Em **Settings → Pages**, selecione **Source: GitHub Actions**.

O site é servido em `/nyx/` (`base` em `vite.config.ts`). As URLs absolutas de SEO vêm de
`VITE_SITE_URL` em `.env`; se o domínio mudar, atualize também `public/robots.txt` e `public/sitemap.xml`.
