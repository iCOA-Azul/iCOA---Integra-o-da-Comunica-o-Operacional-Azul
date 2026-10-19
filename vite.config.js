
import { defineConfig } from "vite";
import { resolve } from "node:path";

const paginas = [
  "index.html",
  "historico.html",
  "atendimento/atendimento.html",
  "atendimento/atendimento-comunicacoes.html",
  "atendimento/ocorrencias.html",
  "atendimento/fids.html",
  "CCO/CCO.html",
  "CCO/CCO-comunicacoes.html",
  "CCO/ocorrencias.html",
  "comercial/comercial.html",
  "comercial/comercial-comunicacoes.html",
  "comercial/ocorrencias.html",
  "handling/handling.html",
  "handling/handling-comunicacoes.html",
  "handling/ocorrencia.html",
  "manutencao/manutencao.html",
  "manutencao/manutencao-comunicacoes.html",
  "manutencao/ocorrencias.html"
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
