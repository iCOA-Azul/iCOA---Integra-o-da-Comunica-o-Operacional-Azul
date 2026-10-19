
import { db, auth } from "../firebase.js";

import {
    collection,
    onSnapshot
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

// ========================================
// ELEMENTOS DA PÁGINA
// ========================================

const listaOcorrencias = document.getElementById("listaOcorrencias");
const semOcorrencias = document.getElementById("semOcorrencias");
const mensagemErro = document.getElementById("mensagemErro");

const pesquisa = document.getElementById("pesquisa");
const filtroStatus = document.getElementById("filtroStatus");
const filtroGravidade = document.getElementById("filtroGravidade");

const contadorOcorrencias =
    document.getElementById("contadorOcorrencias");

const contadorAlta =
    document.getElementById("contadorAlta");

const contadorTotal =
    document.getElementById("contadorTotal");

let todasOcorrencias = [];
let pararDeEscutarOcorrencias = null;

// ========================================
// PROTEGER TEXTOS EXIBIDOS NA TELA
// ========================================

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

// ========================================
// VERIFICAR SE A OCORRÊNCIA É DO ATENDIMENTO
// ========================================

function relacionadaAoAtendimento(ocorrencia) {
    const areas = Array.isArray(ocorrencia.areas)
        ? ocorrencia.areas
        : [];

    return (
        ocorrencia.setor === "Atendimento" ||
        areas.includes("Atendimento")
    );
}

// ========================================
// FORMATAR DATA
// ========================================

function formatarData(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Data não disponível";
    }

    return timestamp.toDate().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========================================
// CONTADORES
// ========================================

function atualizarContadores() {
    const ativas = todasOcorrencias.filter(
        ocorrencia => ocorrencia.status !== "Encerrada"
    );

    contadorOcorrencias.textContent = ativas.length;

    contadorAlta.textContent = ativas.filter(
        ocorrencia => ocorrencia.gravidade === "Alta"
    ).length;

    contadorTotal.textContent = todasOcorrencias.length;
}

// ========================================
// BUSCA E FILTROS
// ========================================

function aplicarFiltros() {
    const termo = pesquisa.value
        .trim()
        .toLocaleLowerCase("pt-BR");

    const statusEscolhido = filtroStatus.value;
    const gravidadeEscolhida = filtroGravidade.value;

    const filtradas = todasOcorrencias.filter(ocorrencia => {
        const encerrada = ocorrencia.status === "Encerrada";

        const areas = Array.isArray(ocorrencia.areas)
            ? ocorrencia.areas
            : [];

        const textoPesquisa = [
            ocorrencia.voo,
            ocorrencia.aeronave,
            ocorrencia.tipo,
            ocorrencia.descricao,
            ocorrencia.setor,
            ocorrencia.status,
            ocorrencia.gravidade,
            ...areas
        ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR");

        const correspondePesquisa =
            textoPesquisa.includes(termo);

        const correspondeStatus =
            statusEscolhido === "Todas" ||
            (statusEscolhido === "Ativas" && !encerrada) ||
            (statusEscolhido === "Encerrada" && encerrada);

        const correspondeGravidade =
            gravidadeEscolhida === "Todas" ||
            ocorrencia.gravidade === gravidadeEscolhida;

        return (
            correspondePesquisa &&
            correspondeStatus &&
            correspondeGravidade
        );
    });

    listaOcorrencias
        .querySelectorAll(".ocorrencia")
        .forEach(card => card.remove());

    semOcorrencias.style.display =
        filtradas.length === 0 ? "block" : "none";

    if (filtradas.length === 0) {
        const titulo = semOcorrencias.querySelector("h4");
        const descricao = semOcorrencias.querySelector("p");

        if (todasOcorrencias.length === 0) {
            titulo.textContent = "Nenhuma ocorrência disponível";
            descricao.textContent =
                "As ocorrências relacionadas ao Atendimento aparecerão aqui.";
        } else {
            titulo.textContent =
                "Nenhuma ocorrência corresponde à pesquisa";

            descricao.textContent =
                "Tente outro termo ou altere os filtros selecionados.";
        }

        return;
    }

    filtradas.forEach(ocorrencia => {
        listaOcorrencias.appendChild(criarCard(ocorrencia));
    });
}

pesquisa.addEventListener("input", aplicarFiltros);
filtroStatus.addEventListener("change", aplicarFiltros);
filtroGravidade.addEventListener("change", aplicarFiltros);

// ========================================
// CRIAR CARD DA OCORRÊNCIA
// ========================================

function criarCard(ocorrencia) {
    let corGravidade = "amarelo";
    let textoGravidade = "MÉDIA";

    if (ocorrencia.gravidade === "Alta") {
        corGravidade = "vermelho";
        textoGravidade = "ALTA";
    } else if (ocorrencia.gravidade === "Baixa") {
        corGravidade = "verde";
        textoGravidade = "BAIXA";
    }

    const areas = Array.isArray(ocorrencia.areas)
        ? ocorrencia.areas.join(", ")
        : "Não informadas";

    const card = document.createElement("article");
    card.className = "ocorrencia";

    card.innerHTML = `
        <div class="status-ocorrencia ${corGravidade}"></div>

        <div class="informacoes-ocorrencia">
            <div class="linha-superior">
                <strong>
                    ${escaparHTML(ocorrencia.voo || "Voo não informado")}
                </strong>

                <span class="status texto-${corGravidade}">
                    ${textoGravidade}
                </span>
            </div>

            <h4>
                ${escaparHTML(ocorrencia.tipo || "Ocorrência operacional")}
            </h4>

            <p>
                ${escaparHTML(ocorrencia.descricao || "Sem descrição")}
            </p>

            <div class="detalhes">
                <span>✈ ${escaparHTML(ocorrencia.aeronave || "Aeronave não informada")}</span>
                <span>Setor: ${escaparHTML(ocorrencia.setor || "Não informado")}</span>
                <span>Status: ${escaparHTML(ocorrencia.status || "Em andamento")}</span>
                <span>Áreas: ${escaparHTML(areas)}</span>
                <span>Atualização: ${escaparHTML(formatarData(ocorrencia.criadoEm))}</span>
            </div>
        </div>

        <button class="botao-ver" type="button">
            Ver detalhes
        </button>
    `;

    card.querySelector(".botao-ver").addEventListener("click", () => {
        alert(
            "INFORMAÇÕES PARA ATENDIMENTO\n\n" +
            "Voo: " + (ocorrencia.voo || "Não informado") +
            "\nAeronave: " + (ocorrencia.aeronave || "Não informada") +
            "\nTipo: " + (ocorrencia.tipo || "Não informado") +
            "\nGravidade: " + (ocorrencia.gravidade || "Não informada") +
            "\nDescrição: " + (ocorrencia.descricao || "Sem descrição") +
            "\nSetor responsável: " + (ocorrencia.setor || "Não informado") +
            "\nÁreas envolvidas: " + areas +
            "\nStatus: " + (ocorrencia.status || "Em andamento") +
            "\nData de registro: " + formatarData(ocorrencia.criadoEm)
        );
    });

    return card;
}

// ========================================
// LOGIN E ATUALIZAÇÕES EM TEMPO REAL
// ========================================

onAuthStateChanged(auth, usuario => {
    if (pararDeEscutarOcorrencias) {
        pararDeEscutarOcorrencias();
        pararDeEscutarOcorrencias = null;
    }

    if (!usuario) {
        window.location.href = "../index.html";
        return;
    }

    mensagemErro.hidden = true;

    semOcorrencias.style.display = "block";
    semOcorrencias.querySelector("h4").textContent =
        "Carregando ocorrências...";
    semOcorrencias.querySelector("p").textContent =
        "Aguarde enquanto as informações são carregadas.";

    pararDeEscutarOcorrencias = onSnapshot(
        collection(db, "ocorrencias"),

        resultado => {
            mensagemErro.hidden = true;

            todasOcorrencias = resultado.docs
                .map(documento => ({
                    ...documento.data(),
                    id: documento.id
                }))
                .filter(relacionadaAoAtendimento)
                .sort((a, b) =>
                    (b.criadoEm?.toMillis?.() ?? 0) -
                    (a.criadoEm?.toMillis?.() ?? 0)
                );

            atualizarContadores();
            aplicarFiltros();
        },

        erro => {
            console.error(
                "Erro ao carregar ocorrências do Atendimento:",
                erro
            );

            mensagemErro.hidden = false;
            semOcorrencias.style.display = "block";

            semOcorrencias.querySelector("h4").textContent =
                "Não foi possível carregar as ocorrências";

            semOcorrencias.querySelector("p").textContent =
                "Verifique sua conexão e as permissões do Firebase.";
        }
    );
});

console.log("iCOA — Consulta de ocorrências do Atendimento carregada.");
