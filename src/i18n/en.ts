import type { Messages } from './messages';

export const en: Messages = {
  meta: {
    title: 'Nyx — turn PDF and PPTX into a presentation in your browser',
    description:
      'Drop a PDF or PowerPoint (PPTX) file and present it fullscreen right from your browser. No sign-up, no upload: your file never leaves your computer.',
    ogTitle: 'Nyx — your slides, on stage',
    ogDescription: 'Drop a PDF or PPTX and present it fullscreen, right from your browser. Nothing is ever sent to a server.',
    ogImageAlt: 'Nyx: your slides, on stage. A slide on a dark screen lit by a small spotlight.',
    twitterDescription: 'Drop a PDF or PPTX and present it fullscreen, right from your browser.',
    appDescription: 'Turn PDF and PPTX files into a fullscreen slide presentation, right in your browser.',
    priceCurrency: 'USD',
  },
  nav: {
    home: 'Nyx, home page',
    sections: 'Sections',
    language: 'Language',
  },
  hero: {
    eyebrow: 'PDF · PPTX <span aria-hidden="true">→</span> presentation',
    title: 'Your slides,<br /><em>on stage.</em>',
    lede: 'Drop the file and present fullscreen, right from your browser. No account, no upload, nothing to install.',
  },
  drop: {
    titlePointer: 'Drop a <em>PDF</em> or <em>PPTX</em> here',
    titleTouch: 'Open a <em>PDF</em> or <em>PPTX</em>',
    or: 'or',
    choose: 'Choose file',
    busy: 'Turning on the lights',
    over: 'Let it go.',
    foot: 'Processed locally · your file never leaves your computer',
  },
  how: {
    id: 'how-it-works',
    title: 'How it works',
    steps: [
      {
        title: 'Drop the file',
        body: 'Drag a PDF or PPTX onto the page, or pick one with the file chooser. It is read right there, in your browser.',
      },
      {
        title: 'Review the slides',
        body: 'Browse the thumbnail strip or open the grid to jump straight to any slide.',
      },
      {
        title: 'Present',
        body: 'Fullscreen in one tap. The cursor becomes a small lens that adapts to the background, light or dark, so you never lose it on the slide.',
      },
    ],
  },
  keys: {
    id: 'shortcuts',
    title: 'Shortcuts',
    next: 'Next slide',
    prev: 'Previous slide',
    firstLast: 'First and last',
    fullscreen: 'Fullscreen',
    grid: 'Slide grid',
    blackout: 'Black out the screen',
    exit: 'Exit',
    space: 'Space',
  },
  faq: {
    id: 'faq',
    title: 'Questions',
    items: [
      {
        question: 'Is my file uploaded to a server?',
        answer:
          'No. Nyx is a static site: the PDF or PPTX is read entirely by your browser and not a single byte leaves your computer. You can even go offline once the page has loaded.',
      },
      {
        question: 'Which formats are supported?',
        answer:
          'PDF and PowerPoint (<code>.pptx</code>). Older <code>.ppt</code> files, Keynote and Google Slides can be exported as PDF or PPTX first.',
      },
      {
        question: 'Does the PPTX look exactly like PowerPoint?',
        answer:
          'Text, images, shapes, tables and backgrounds are reproduced. Animations, videos and native charts are left out. If fidelity matters, export as PDF: it comes out pixel for pixel.',
      },
      {
        question: 'Does it work on mobile?',
        answer: 'Yes. Swipe sideways to change slides. The spotlight only shows up with a mouse, since touch has no cursor.',
      },
    ],
  },
  footer: {
    tagline: 'Made for people who present.',
    source: 'Source on GitHub',
  },
  errors: {
    unreadable: "We couldn't read this file. It may be corrupted or password-protected.",
    unsupportedFormat: "This format isn't supported yet. Export it as PDF or PPTX.",
    notPdfOrPptx: 'Please choose a PDF or PPTX file.',
    invalidPptx: "This file doesn't look like a valid PowerPoint presentation.",
    noSlides: "We couldn't find any visible slides in this file.",
  },
  viewer: {
    back: 'Back (Esc)',
    close: 'Close presentation',
    gridHint: 'Slide grid (G)',
    showAll: 'Show all slides',
    presentHint: 'Present fullscreen (F)',
    present: 'Present',
    prev: 'Previous slide',
    next: 'Next slide',
    thumbnails: 'Slide thumbnails',
    exitFullscreen: 'Exit fullscreen',
    allSlides: 'All slides',
    closeGrid: 'Close grid',
    slideCount: (total) => `<em>${total}</em> ${total === 1 ? 'slide' : 'slides'}`,
    goTo: (n) => `Go to slide ${n}`,
    broken: "This slide couldn't be drawn.",
  },
};
