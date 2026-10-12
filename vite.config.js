
import { defineConfig } from "vite";
import { resolve } from "node:path";

const paginas = [
  "index.html",
  "historico.html",
  "atendimento/atendimento.html",
  "atendimento/atendimento-comunicacoes.html",
  "CCO/CCO.html",
  "CCO/CCO-comunicacoes.html",
  "comercial/comercial.html",
  "comercial/comercial-comunicacoes.html",
  "handling/handling.html",
  "handling/handling-comunicacoes.html",
  "manutencao/manutencao.html",
  "manutencao/manutencao-comunicacoes.html"
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        paginas.map((pagina, indice) => [
          `pagina${indice}`,
          resolve(process.cwd(), pagina)
        ])
      )
    }
  }
});
