/// <reference types="vite/client" />

/** Asset imports that Vite resolves to a URL string. */
declare module '*?url' {
  const url: string;
  export default url;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
