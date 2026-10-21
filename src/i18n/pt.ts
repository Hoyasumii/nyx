import type { Messages } from './messages';

export const pt: Messages = {
  meta: {
    title: 'Nyx — transforme PDF e PPTX em apresentação no navegador',
    description:
      'Solte um PDF ou PowerPoint (PPTX) e apresente em tela cheia direto do navegador. Sem cadastro, sem upload: o arquivo nunca sai do seu computador.',
    ogTitle: 'Nyx — seus slides, em cena',
    ogDescription: 'Solte um PDF ou PPTX e apresente em tela cheia, direto do navegador. Nada é enviado para servidor nenhum.',
    ogImageAlt: 'Nyx: seus slides, em cena. Um slide em tela escura iluminado por um pequeno holofote.',
    twitterDescription: 'Solte um PDF ou PPTX e apresente em tela cheia, direto do navegador.',
    appDescription: 'Transforme arquivos PDF e PPTX em uma apresentação de slides em tela cheia, direto no navegador.',
    priceCurrency: 'BRL',
  },
  nav: {
    home: 'Nyx, página inicial',
    sections: 'Seções',
    language: 'Idioma',
  },
  hero: {
    eyebrow: 'PDF · PPTX <span aria-hidden="true">→</span> apresentação',
    title: 'Seus slides,<br /><em>em cena.</em>',
    lede: 'Solte o arquivo e apresente em tela cheia, direto do navegador. Sem conta, sem upload, sem instalar nada.',
  },
  drop: {
    titlePointer: 'Solte aqui um <em>PDF</em> ou <em>PPTX</em>',
    titleTouch: 'Abra um <em>PDF</em> ou <em>PPTX</em>',
    or: 'ou',
    choose: 'Escolher arquivo',
    busy: 'Acendendo as luzes',
    over: 'Pode soltar.',
    foot: 'Processado localmente · o arquivo não sai do seu computador',
  },
  how: {
    id: 'como-funciona',
    title: 'Como funciona',
    steps: [
      {
        title: 'Solte o arquivo',
        body: 'Arraste um PDF ou PPTX para a página, ou escolha pelo seletor. A leitura acontece ali mesmo, no navegador.',
      },
      {
        title: 'Revise os slides',
        body: 'Navegue pela tira de miniaturas ou abra a grade para pular direto para qualquer slide.',
      },
      {
        title: 'Apresente',
        body: 'Tela cheia com um toque. O cursor vira uma pequena lente que se adapta ao fundo, clara ou escura, para você nunca se perder no slide.',
      },
    ],
  },
  keys: {
    id: 'atalhos',
    title: 'Atalhos',
    next: 'Próximo slide',
    prev: 'Slide anterior',
    firstLast: 'Primeiro e último',
    fullscreen: 'Tela cheia',
    grid: 'Grade de slides',
    blackout: 'Escurecer a tela',
    exit: 'Sair',
    space: 'Espaço',
  },
  faq: {
    id: 'perguntas',
    title: 'Perguntas',
    items: [
      {
        question: 'Meu arquivo é enviado para algum servidor?',
        answer:
          'Não. O Nyx é um site estático: o PDF ou PPTX é lido inteiramente pelo seu navegador e nenhum byte sai do seu computador. Você pode até desconectar a internet depois que a página carregar.',
      },
      {
        question: 'Quais formatos são aceitos?',
        answer:
          'PDF e PowerPoint (<code>.pptx</code>). Arquivos <code>.ppt</code> antigos, Keynote e Google Slides podem ser exportados como PDF ou PPTX antes.',
      },
      {
        question: 'O PPTX fica idêntico ao PowerPoint?',
        answer:
          'Textos, imagens, formas, tabelas e fundos são reproduzidos. Animações, vídeos e gráficos nativos ficam de fora. Se a fidelidade for essencial, exporte como PDF: ele sai pixel a pixel.',
      },
      {
        question: 'Funciona no celular?',
        answer: 'Sim. Deslize para os lados para trocar de slide. O holofote aparece só com mouse, já que no toque não existe cursor.',
      },
    ],
  },
  footer: {
    tagline: 'Feito para quem apresenta.',
    source: 'Código no GitHub',
  },
  errors: {
    unreadable: 'Não conseguimos ler esse arquivo. Ele pode estar corrompido ou protegido por senha.',
    unsupportedFormat: 'Esse formato ainda não é suportado. Exporte como PDF ou PPTX.',
    notPdfOrPptx: 'Envie um arquivo PDF ou PPTX.',
    invalidPptx: 'Este arquivo não parece ser uma apresentação PowerPoint válida.',
    noSlides: 'Não encontramos nenhum slide visível neste arquivo.',
  },
  viewer: {
    back: 'Voltar (Esc)',
    close: 'Fechar apresentação',
    gridHint: 'Grade de slides (G)',
    showAll: 'Ver todos os slides',
    presentHint: 'Apresentar em tela cheia (F)',
    present: 'Apresentar',
    prev: 'Slide anterior',
    next: 'Próximo slide',
    thumbnails: 'Miniaturas dos slides',
    exitFullscreen: 'Sair da tela cheia',
    allSlides: 'Todos os slides',
    closeGrid: 'Fechar grade',
    slideCount: (total) => `<em>${total}</em> ${total === 1 ? 'slide' : 'slides'}`,
    goTo: (n) => `Ir para o slide ${n}`,
    broken: 'Não foi possível desenhar este slide.',
  },
};
