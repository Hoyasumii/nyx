# Nyx

**Seus slides, em cena.** Solte um PDF ou PPTX e apresente em tela cheia direto do navegador.
Sem conta, sem upload: o arquivo é lido localmente e nunca sai do computador.

🌙 https://nyx.hoyasumii.dev/ · em inglês: https://nyx.hoyasumii.dev/en/

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
npm run dev        # servidor local em http://localhost:5173/
npm test           # testes unitários (vitest)
npm run build      # typecheck + build de produção em dist/
```

### Idiomas

O site existe em português (`/`) e inglês (`/en/`). Os textos ficam em `src/i18n/pt.ts` e `src/i18n/en.ts`
(tipados por `src/i18n/messages.ts`), e cada idioma é configurado em `src/i18n/locales.ts`.
O `index.html` é um template único: no build (e no `npm run dev`), o plugin `scripts/vite-i18n.ts` gera
uma página estática por idioma, com `lang`, metadados, OpenGraph, `hreflang` e JSON-LD próprios.
Use `{{ chave.caminho }}` para texto escapado e `{{{ chave.caminho }}}` para HTML. No navegador,
`src/i18n/index.ts` lê o `lang` da página e expõe as mensagens do viewer e dos erros.

Para adicionar um idioma: crie o dicionário, registre-o em `locales.ts`, adicione o card em
`scripts/render-assets.mjs` e a URL em `public/sitemap.xml`.

### Imagem OpenGraph e ícones

`public/og.png` (português), `public/og-en.png` (inglês) e os ícones PNG são gerados a partir de
`scripts/og/og.html` e `public/logo.svg`:

```bash
npx playwright install chromium   # uma vez
npm run assets                    # ou CHROMIUM_PATH=/caminho/do/chrome npm run assets
```

## Deploy

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`.
Em **Settings → Pages**, selecione **Source: GitHub Actions**.

O site é servido na raiz do domínio `nyx.hoyasumii.dev` (`base` em `vite.config.ts`, domínio em `public/CNAME`). As URLs absolutas de SEO vêm de
`VITE_SITE_URL` em `.env`; se o domínio mudar, atualize também `public/CNAME`, `public/robots.txt` e `public/sitemap.xml`.
